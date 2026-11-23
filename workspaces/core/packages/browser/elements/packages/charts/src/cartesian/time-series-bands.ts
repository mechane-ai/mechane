import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import type { TimeSeries, TimeSeriesPoint, ToneResolver } from './time-series-data.ts';

/** One observation of a band. Both bounds are present or both are missing; a missing center draws no line there. */
export type TimeSeriesBandPoint = {
  readonly timestamp: number;
  readonly lower: number | null;
  readonly center: number | null;
  readonly upper: number | null;
};

/**
 * A shaded range between supplied lower and upper values, with an optional center line, such as low, expected and high
 * outcomes. The application computes every bound and names the range; the chart only draws and reads it.
 */
export type TimeSeriesBand = {
  readonly id: string;
  /** Names the center line, such as "Expected". */
  readonly label: string;
  /** Names the shaded range in inspection and exact values, such as "Low to high". */
  readonly rangeLabel: string;
  readonly points: ReadonlyArray<TimeSeriesBandPoint>;
  /** Absent takes the next automatic series tone after the line series. */
  readonly tone?: ChartTone | undefined;
};

/**
 * Marks where a drawn line first reaches a value, such as zero. The chart interpolates between the two adjacent
 * recorded observations exactly as it draws the line, so the marker lands where the line meets the value. Gaps never
 * cross.
 */
export type TimeSeriesCrossing = {
  readonly id: string;
  /** A line series, or a band whose center line is tested. */
  readonly seriesId: string;
  readonly value: number;
  readonly label: string;
  /** Which way the line must pass through the value. Absent accepts either direction. */
  readonly direction?: 'falling' | 'rising' | undefined;
};

export type PlotBand = Omit<TimeSeriesBand, 'tone'> & { readonly tone: ChartTone };

export type FoundCrossing = { readonly crossing: TimeSeriesCrossing; readonly timestamp: number | undefined };

export const timeSeriesBandLimits = { bands: 4, crossings: 4 } as const;

function bandPointProblem(point: TimeSeriesBandPoint): string | undefined {
  const values = [point.lower, point.center, point.upper].filter((value) => value !== null);

  if (values.some((value) => !Number.isFinite(value))) {
    return 'Band values must be finite numbers or explicit missing values.';
  }

  if ((point.lower === null) !== (point.upper === null)) {
    return 'A band observation needs both bounds or neither.';
  }

  const isOrdered = values.every((value, index) => index === 0 || (values[index - 1] ?? value) <= value);

  return isOrdered ? undefined : 'Band values must satisfy lower ≤ center ≤ upper.';
}

export function validateBands({
  bands,
  crossings,
  series,
  timestamps,
}: {
  readonly bands: ReadonlyArray<TimeSeriesBand>;
  readonly crossings: ReadonlyArray<TimeSeriesCrossing>;
  readonly series: ReadonlyArray<TimeSeries>;
  readonly timestamps: ReadonlyArray<number>;
}): string | undefined {
  if (bands.length > timeSeriesBandLimits.bands || crossings.length > timeSeriesBandLimits.crossings) {
    return `Supply at most ${timeSeriesBandLimits.bands} bands and ${timeSeriesBandLimits.crossings} crossings.`;
  }

  if (!hasUniqueIds([...series, ...bands]) || !hasUniqueIds(crossings)) {
    return 'Series, bands, and crossings require unique identifiers.';
  }

  for (const band of bands) {
    const isAligned = band.points.length === timestamps.length;

    if (!isAligned || band.points.some((point, index) => point.timestamp !== timestamps[index])) {
      return 'Every band must supply the same observation timestamps as the series.';
    }

    const problem = band.points.map(bandPointProblem).find((issue) => issue !== undefined);

    if (problem !== undefined) {
      return problem;
    }
  }

  const lineIds = new Set([...series, ...bands].map((item) => item.id));

  for (const crossing of crossings) {
    const isKnown = lineIds.has(crossing.seriesId) && crossing.label.trim() !== '';

    if (!isKnown || !Number.isFinite(crossing.value)) {
      return 'Each crossing needs a label, a finite value, and a supplied series or band.';
    }
  }

  return undefined;
}

export function prepareBands({
  series,
  bands,
  tones,
}: {
  readonly series: ReadonlyArray<TimeSeries>;
  readonly bands: ReadonlyArray<TimeSeriesBand>;
  readonly tones: ToneResolver;
}): ReadonlyArray<PlotBand> {
  const automaticSeries = series.filter((item) => item.tone === undefined).length;
  const automaticBands = bands.filter((band) => band.tone === undefined);

  return bands.map((band) => {
    const slot = automaticSeries + automaticBands.findIndex((candidate) => candidate.id === band.id);

    return { ...band, tone: tones({ id: band.id, tone: band.tone, index: slot }) };
  });
}

function isThrough({
  start,
  end,
  value,
  direction,
}: {
  readonly start: number;
  readonly end: number;
  readonly value: number;
  readonly direction: TimeSeriesCrossing['direction'];
}): boolean {
  const isFalling = start > value && end <= value;
  const isRising = start < value && end >= value;

  switch (direction) {
    case 'falling':
      return isFalling;
    case 'rising':
      return isRising;
    case undefined:
      return isFalling || isRising;
  }
}

/** The first interpolated timestamp where the drawn line reaches the value, or undefined when it never does. */
function crossingTimestamp({
  points,
  crossing,
}: {
  readonly points: ReadonlyArray<TimeSeriesPoint>;
  readonly crossing: TimeSeriesCrossing;
}): number | undefined {
  const segments = points.flatMap((point, index) => {
    const next = points[index + 1];

    if (point.value === null || next === undefined || next.value === null) {
      return [];
    }

    return [{ start: point.timestamp, end: next.timestamp, from: point.value, to: next.value }];
  });

  const segment = segments.find(({ from, to }) =>
    isThrough({ start: from, end: to, value: crossing.value, direction: crossing.direction }),
  );

  if (segment === undefined) {
    return undefined;
  }

  const share = (crossing.value - segment.from) / (segment.to - segment.from);

  return segment.start + share * (segment.end - segment.start);
}

export function findCrossings({
  crossings,
  series,
  bands,
}: {
  readonly crossings: ReadonlyArray<TimeSeriesCrossing>;
  readonly series: ReadonlyArray<TimeSeries>;
  readonly bands: ReadonlyArray<TimeSeriesBand>;
}): ReadonlyArray<FoundCrossing> {
  return crossings.map((crossing) => {
    const line = series.find((item) => item.id === crossing.seriesId);

    const points =
      line?.points ??
      bands
        .find((band) => band.id === crossing.seriesId)
        ?.points.map((point) => ({ timestamp: point.timestamp, value: point.center })) ??
      [];

    return { crossing, timestamp: crossingTimestamp({ points, crossing }) };
  });
}

/** The observation timestamp nearest an instant, which owns that instant in keyboard and pointer inspection. */
export function nearestTimestamp(timestamps: ReadonlyArray<number>, instant: number): number | undefined {
  const distance = Math.min(...timestamps.map((timestamp) => Math.abs(timestamp - instant)));

  return timestamps.find((timestamp) => Math.abs(timestamp - instant) === distance);
}

export function bandValues(bands: ReadonlyArray<TimeSeriesBand>): ReadonlyArray<number> {
  return bands.flatMap((band) =>
    band.points.flatMap((point) => [point.lower, point.center, point.upper].filter((value) => value !== null)),
  );
}

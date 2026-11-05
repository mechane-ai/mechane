import { hasUniqueIds } from '../chart-input.tsx';
import type { ChartTone } from '../chart-theme.ts';

export type TimeSeriesPoint = { readonly timestamp: number; readonly value: number | null };

export type TimeSeries = {
  readonly id: string;
  readonly label: string;
  readonly points: ReadonlyArray<TimeSeriesPoint>;
  readonly tone?: ChartTone | undefined;
};

export type TimeSeriesMarker = { readonly id: string; readonly timestamp: number; readonly label: string } & (
  | { readonly kind: 'time'; readonly seriesId?: never; readonly value?: never }
  | { readonly kind: 'point'; readonly seriesId: string; readonly value: number }
);

export type PlotPoint = { readonly timestamp: number; readonly value: number | null; readonly base: number };

export type PlotSeries = {
  readonly id: string;
  readonly label: string;
  readonly tone: ChartTone;
  readonly points: ReadonlyArray<PlotPoint>;
};

export const timeSeriesLimits = { series: 12, pointsPerSeries: 2000, markers: 200, panels: 12 } as const;
const DOMAIN_PADDING_RATIO = 0.01;
const AUTOMATIC_TONES: ReadonlyArray<ChartTone> = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'];

export function validateTimeSeries({
  series,
  isStacked,
  markers,
}: {
  readonly series: ReadonlyArray<TimeSeries>;
  readonly isStacked: boolean;
  readonly markers: ReadonlyArray<TimeSeriesMarker>;
}): string | undefined {
  const timestamps = series[0]?.points.map((point) => point.timestamp) ?? [];

  if (
    series.length > timeSeriesLimits.series ||
    timestamps.length > timeSeriesLimits.pointsPerSeries ||
    markers.length > timeSeriesLimits.markers
  ) {
    return `Choose a window with at most ${timeSeriesLimits.series} series, ${timeSeriesLimits.pointsPerSeries} observations per series, and ${timeSeriesLimits.markers} markers.`;
  }

  if (!hasUniqueIds(series) || !hasUniqueIds(markers)) {
    return 'Series and markers require unique identifiers.';
  }

  for (const item of series) {
    if (item.points.length !== timestamps.length) {
      return 'Every series must supply the same observation timestamps.';
    }

    const issue = validateObservations({ points: item.points, timestamps, isStacked });

    if (issue !== undefined) {
      return issue;
    }
  }

  for (const marker of markers) {
    if (!timestamps.includes(marker.timestamp)) {
      return 'Every marker must align with an observation timestamp.';
    }

    if (marker.kind === 'point') {
      const point = series
        .find((item) => item.id === marker.seriesId)
        ?.points.find((item) => item.timestamp === marker.timestamp);

      if (point === undefined || point.value !== marker.value) {
        return 'Point markers must reference the recorded series value.';
      }
    }
  }

  const observed = series.flatMap((item) =>
    item.points.flatMap((point) => (point.value === null ? [] : [point.value])),
  );

  const valueSpan = Math.max(0, ...observed) - Math.min(0, ...observed);
  const timeSpan = (timestamps.at(-1) ?? 0) - (timestamps[0] ?? 0);

  if (!Number.isFinite(valueSpan) || !Number.isFinite(timeSpan)) {
    return 'The elapsed-time and value ranges must be finite.';
  }

  if (
    isStacked &&
    timestamps.some(
      (_, index) => !Number.isFinite(series.reduce((sum, item) => sum + (item.points[index]?.value ?? 0), 0)),
    )
  ) {
    return 'Stacked observation totals must be finite.';
  }

  return undefined;
}

export function timeSeriesSignature({
  series,
  markers,
  timestampUnit,
  isStacked,
}: {
  readonly series: ReadonlyArray<TimeSeries>;
  readonly markers: ReadonlyArray<TimeSeriesMarker>;
  readonly timestampUnit: string;
  readonly isStacked: boolean;
}): string {
  return JSON.stringify([
    timestampUnit,
    isStacked,
    series.map((item) => [item.id, item.label, item.tone, item.points.map((point) => [point.timestamp, point.value])]),
    markers.map((marker) => [marker.id, marker.kind, marker.timestamp, marker.label, marker.seriesId, marker.value]),
  ]);
}

export function observationDomain(
  minimum: number,
  maximum: number,
  shouldStartAtZero = false,
): readonly [number, number] {
  if (minimum !== maximum) {
    return [minimum, maximum];
  }

  const padding = Math.max(1, Math.abs(minimum) * DOMAIN_PADDING_RATIO);
  const lower = shouldStartAtZero ? 0 : minimum - padding;
  const upper = maximum + padding;

  return [Number.isFinite(lower) ? lower : minimum, Number.isFinite(upper) ? upper : maximum];
}

export function prepareTimeSeries(series: ReadonlyArray<TimeSeries>, isStacked: boolean): ReadonlyArray<PlotSeries> {
  const automatic = series.filter((item) => item.tone === undefined);

  return series.map((item, seriesIndex) => {
    const automaticIndex = automatic.findIndex((candidate) => candidate.id === item.id);
    const tone = item.tone ?? AUTOMATIC_TONES[automaticIndex % AUTOMATIC_TONES.length] ?? 'series1';

    const points = item.points.map((point, pointIndex) => {
      const base = isStacked
        ? series
            .slice(0, seriesIndex)
            .reduce((total, preceding) => total + (preceding.points[pointIndex]?.value ?? 0), 0)
        : 0;

      return { ...point, base };
    });

    return { id: item.id, label: item.label, tone, points };
  });
}

function validateObservations({
  points,
  timestamps,
  isStacked,
}: {
  readonly points: ReadonlyArray<TimeSeriesPoint>;
  readonly timestamps: ReadonlyArray<number>;
  readonly isStacked: boolean;
}): string | undefined {
  for (const [index, point] of points.entries()) {
    const previous = points[index - 1];
    const isOutOfOrder = previous !== undefined && point.timestamp <= previous.timestamp;

    if (!Number.isFinite(point.timestamp) || point.timestamp !== timestamps[index] || isOutOfOrder) {
      return 'Observation timestamps must be finite, aligned, and strictly increasing.';
    }

    if (point.value !== null && !Number.isFinite(point.value)) {
      return 'Observations must be finite numbers or explicit missing values.';
    }

    if (isStacked && (point.value === null || point.value < 0)) {
      return 'Stacked observations must be present and nonnegative.';
    }
  }

  return undefined;
}

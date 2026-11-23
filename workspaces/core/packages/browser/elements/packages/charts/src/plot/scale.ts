import { fractionOf, valueAt } from '@ui-sdk/core/number';
import type { NumberScale } from '@ui-sdk/core/number';

export type NumericDomain = readonly [minimum: number, maximum: number];

/**
 * How values spread along an axis: evenly, by ratio, or by ratio on both sides of zero. A log axis needs a positive
 * domain. A symlog axis is linear within one unit of zero, so it can hold zero and signed values.
 */
export type ScaleType = 'linear' | 'log' | 'symlog';

export type ContinuousScale = {
  readonly type: ScaleType;
  readonly domain: NumericDomain;
  readonly range: readonly [number, number];
  /** Where a value sits. One outside the domain sits at the nearest end. Charts reject such input before drawing. */
  readonly position: (value: number) => number;
  /** The value at a position, such as the one under a pointer. */
  readonly valueAt: (position: number) => number;
};

export type BandScale = {
  readonly ids: ReadonlyArray<string>;
  /** The distance from one band's start to the next. */
  readonly step: number;
  readonly bandwidth: number;
  /** Where an id's band starts, or undefined for an id the scale does not hold. */
  readonly start: (id: string) => number | undefined;
  readonly center: (id: string) => number | undefined;
  /** The id whose step holds a position, such as the one under a pointer. Positions outside the range take an end. */
  readonly idAt: (position: number) => string | undefined;
};

const symmetricLog = {
  to: (value: number) => Math.sign(value) * Math.log1p(Math.abs(value)),
  from: (position: number) => Math.sign(position) * Math.expm1(Math.abs(position)),
} as const satisfies NumberScale;

const numberScales: Readonly<Record<ScaleType, NumberScale>> = { linear: 'linear', log: 'log', symlog: symmetricLog };

const HALF = 0.5;

export function isFiniteDomain(domain: NumericDomain): boolean {
  const hasFiniteBounds = Number.isFinite(domain[0]) && Number.isFinite(domain[1]);

  return hasFiniteBounds && Number.isFinite(domain[1] - domain[0]) && domain[0] < domain[1];
}

/** Why a domain cannot carry a scale type, or undefined when it can. */
export function scaleDomainError(domain: NumericDomain, type: ScaleType = 'linear'): string | undefined {
  if (!isFiniteDomain(domain)) {
    return 'The chart domain must contain two finite, increasing values.';
  }

  if (type === 'log' && domain[0] <= 0) {
    return 'A log axis needs a domain above zero. Use a symlog axis for zero or signed values.';
  }

  return undefined;
}

export function outsideDomain(value: number, domain: NumericDomain): boolean {
  return !Number.isFinite(value) || value < domain[0] || value > domain[1];
}

export type ContinuousScaleInput = {
  readonly type?: ScaleType | undefined;
  readonly domain: NumericDomain;
  /** The positions of the domain's two ends. Pass them reversed for an axis that grows upward on screen. */
  readonly range: readonly [number, number];
};

/** A scale for measured values, on the UI SDK number helpers that sliders and meters place their values with. */
export function continuousScale({ type = 'linear', domain, range }: ContinuousScaleInput): ContinuousScale {
  const bounds = { min: domain[0], max: domain[1] };
  const curve = numberScales[type];
  const span = range[1] - range[0];

  return {
    type,
    domain,
    range,
    position: (value) => range[0] + fractionOf(value, bounds, curve) * span,
    valueAt: (position) => valueAt(span === 0 ? 0 : (position - range[0]) / span, bounds, curve),
  };
}

export type BandScaleInput = {
  readonly ids: ReadonlyArray<string>;
  readonly range: readonly [number, number];
  /** The share of each step left empty between bands and at both ends, from 0 to 1. */
  readonly padding?: number | undefined;
};

/** A scale for named categories in supplied order: each takes an equal band, with the same gap at both ends. */
export function bandScale({ ids, range, padding = 0 }: BandScaleInput): BandScale {
  const step = (range[1] - range[0]) / Math.max(1, ids.length + padding);
  const bandwidth = step * (1 - padding);
  const first = range[0] + step * padding;
  const indices = new Map(ids.map((id, index) => [id, index]));

  function start(id: string): number | undefined {
    const index = indices.get(id);

    return index === undefined ? undefined : first + index * step;
  }

  return {
    ids,
    step,
    bandwidth,
    start,
    center: (id) => {
      const edge = start(id);

      return edge === undefined ? undefined : edge + bandwidth * HALF;
    },
    idAt: (position) => {
      const gap = (step - bandwidth) * HALF;
      const index = Math.floor((position - first + gap) / step);

      return ids[Math.max(0, Math.min(ids.length - 1, index))];
    },
  };
}

/** The smallest and largest value of a column, or undefined for an empty column. It reads a million values safely. */
export function columnExtent(values: ReadonlyArray<number>): NumericDomain | undefined {
  const bounds = { low: Number.POSITIVE_INFINITY, high: Number.NEGATIVE_INFINITY };

  for (const value of values) {
    bounds.low = Math.min(bounds.low, value);
    bounds.high = Math.max(bounds.high, value);
  }

  return bounds.low <= bounds.high ? [bounds.low, bounds.high] : undefined;
}

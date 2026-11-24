import type { NumericDomain } from '../../../../charts/src/index.ts';
import type { SceneDataPoint, ScenePosition } from '../scene-geometry.ts';

/** How many samples a function curve takes across the whole data box, by name. */
export const curveResolutions = { coarse: 60, regular: 160, fine: 400 } as const;

/** How finely a function curve is sampled. Use `fine` for a curve the camera zooms into. */
export type SceneCurveResolution = keyof typeof curveResolutions;

/** The most points one curve or polygon takes. Larger input shows an error. */
export const planeLimits = { curvePoints: 2000, polygonPoints: 200 } as const;

/** How thick a curve or vector is drawn. */
export type ScenePlaneThickness = 'thin' | 'regular' | 'thick';

/** The stroke width of each named thickness, in pixels. */
export const planeThicknesses = { thin: 1.25, regular: 1.75, thick: 3 } as const;

const HALF = 0.5;

/** The scene's data box. */
export type DataBox = { readonly x: NumericDomain; readonly y: NumericDomain };

/** A value held between the two ends of a domain. A value that is not a number lands in the middle. */
export function insideDomain(value: number, domain: NumericDomain): number {
  if (!Number.isFinite(value)) {
    return (domain[0] + domain[1]) * HALF;
  }

  return Math.min(domain[1], Math.max(domain[0], value));
}

/** A position held inside the data box. */
export function insideBox(position: ScenePosition, box: DataBox): ScenePosition {
  return [insideDomain(position[0], box.x), insideDomain(position[1], box.y)];
}

/** `count` evenly spaced values from one end of the domain to the other. */
export function gridXs(domain: NumericDomain, count: number): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) => domain[0] + ((domain[1] - domain[0]) * index) / (count - 1));
}

/** The index of the first point whose x reaches `x`, or the length when none does. Points increase in x. */
function lowerBound(points: ReadonlyArray<ScenePosition>, across: number): number {
  const search = { low: 0, high: points.length };

  while (search.low < search.high) {
    const middle = Math.floor((search.low + search.high) * HALF);

    if ((points[middle]?.[0] ?? Number.POSITIVE_INFINITY) < across) {
      search.low = middle + 1;
    } else {
      search.high = middle;
    }
  }

  return search.low;
}

/** The y of a polyline at `x`, holding the first and last values beyond its ends. Points increase in x. */
export function interpolateAt(points: ReadonlyArray<ScenePosition>, across: number): number {
  const after = lowerBound(points, across);
  const next = points[after];
  const previous = points[after - 1];

  if (next === undefined) {
    return previous?.[1] ?? 0;
  }

  if (previous === undefined || next[0] === across) {
    return next[1];
  }

  return previous[1] + ((next[1] - previous[1]) * (across - previous[0])) / (next[0] - previous[0]);
}

/** The part of a sampled curve that lies between `from` and `to`, with a vertex exactly at each end. */
export function visibleRun({
  xs,
  ys,
  from,
  to,
}: {
  readonly xs: ReadonlyArray<number>;
  readonly ys: ReadonlyArray<number>;
  readonly from: number;
  readonly to: number;
}): ReadonlyArray<SceneDataPoint> {
  const grid = xs.map((across, index): ScenePosition => [across, ys[index] ?? 0]);
  const inside = grid.flatMap(([across, up]) => (across > from && across < to ? [{ x: across, y: up }] : []));

  return [{ x: from, y: interpolateAt(grid, from) }, ...inside, { x: to, y: interpolateAt(grid, to) }];
}

function mean(values: ReadonlyArray<number>): number {
  const total = { sum: 0 };

  for (const value of values) {
    total.sum += value;
  }

  return total.sum / Math.max(1, values.length);
}

/** The mean of a polygon's corners, which is a fair place for its name and for a keyboard cursor. */
export function centroid(corners: ReadonlyArray<SceneDataPoint>): SceneDataPoint {
  return { x: mean(corners.map((corner) => corner.x)), y: mean(corners.map((corner) => corner.y)) };
}

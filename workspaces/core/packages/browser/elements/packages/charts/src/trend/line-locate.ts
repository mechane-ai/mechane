import type { ChartPoint } from '../chart.tsx';

/** A vertex of a drawn line, in the plot's pixels. A null `y` is a missing value: the line breaks there. */
export type LocatedPoint = { readonly x: number; readonly y: number | null };

/** A line the pointer can inspect, by the id of the thing it draws. */
export type LocatedLine = { readonly id: string; readonly points: ReadonlyArray<LocatedPoint> };

type Spot = { readonly x: number; readonly y: number };

function segmentDistance({
  point,
  from,
  to,
}: {
  readonly point: Spot;
  readonly from: Spot;
  readonly to: Spot;
}): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared === 0 ? 0 : ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const share = Math.max(0, Math.min(1, along));

  return Math.hypot(point.x - (from.x + share * dx), point.y - (from.y + share * dy));
}

function lineDistance(point: Spot, points: ReadonlyArray<LocatedPoint>): number {
  const distances = points.flatMap((start, index) => {
    if (start.y === null) {
      return [];
    }

    const next = points[index + 1];
    const from = { x: start.x, y: start.y };
    const to = next !== undefined && next.y !== null ? { x: next.x, y: next.y } : from;

    return [segmentDistance({ point, from, to })];
  });

  return Math.min(Infinity, ...distances);
}

const HIT_RADIUS_PX = 10;

/**
 * A chart `locate` for lines: the pointer inspects the nearest drawn path within `maxDistance` pixels. Open whitespace
 * returns undefined, so hovering only fires on a line.
 */
export function locateNearestLine({
  lines,
  width,
  height,
  maxDistance = HIT_RADIUS_PX,
}: {
  readonly lines: ReadonlyArray<LocatedLine>;
  /** The size the lines were laid out in. The pointer arrives in rendered pixels and is rescaled to it. */
  readonly width: number;
  readonly height: number;
  /** Farthest a pointer may sit from a line and still inspect it, in plot pixels. */
  readonly maxDistance?: number | undefined;
}): (point: ChartPoint) => string | undefined {
  return (point) => {
    const spot = { x: (point.x / point.width) * width, y: (point.y / point.height) * height };
    const distances = lines.map((line) => lineDistance(spot, line.points));
    const best = Math.min(...distances);

    return best > maxDistance ? undefined : lines[distances.indexOf(best)]?.id;
  };
}

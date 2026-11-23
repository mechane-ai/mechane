import type { NumericDomain } from '../scale.ts';

/**
 * Many points as plain columns: the nth point sits at `x[n]`, `y[n]` in data units and belongs to the group at index
 * `group[n]`. Columns keep a million points cheap to hold, send and draw.
 */
export type PointColumns = {
  readonly x: ReadonlyArray<number>;
  readonly y: ReadonlyArray<number>;
  readonly group: ReadonlyArray<number>;
};

/** A rectangle in data units. */
export type DataRect = { readonly x: NumericDomain; readonly y: NumericDomain };

/** Where to look for a point: a position in data units and how far to look along each axis, also in data units. */
export type HitQuery = { readonly x: number; readonly y: number; readonly radiusX: number; readonly radiusY: number };

/** Finds the point nearest a position, such as the one under a pointer, without visiting every point. */
export type HitIndex = {
  /** The index of the nearest point inside the query's ellipse, or undefined when none lies there. */
  readonly nearest: (query: HitQuery) => number | undefined;
};

const POINTS_PER_CELL = 4;
const CELLS_PER_AXIS_MAX = 1024;

function cellOf(value: number, domain: NumericDomain, cells: number): number {
  const fraction = (value - domain[0]) / (domain[1] - domain[0]);

  return Math.max(0, Math.min(cells - 1, Math.floor(fraction * cells)));
}

function span(first: number, last: number): ReadonlyArray<number> {
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

/**
 * A uniform grid over the points' domain. Building it visits each point twice; a query visits only the points in the
 * cells its ellipse touches. Rebuild it when the points change, not when the view pans or zooms.
 */
export function hitIndex({ points, domain }: { readonly points: PointColumns; readonly domain: DataRect }): HitIndex {
  const count = points.x.length;
  const cells = Math.max(1, Math.min(CELLS_PER_AXIS_MAX, Math.round(Math.sqrt(count / POINTS_PER_CELL))));

  const homes = new Int32Array(count);

  for (const [index, x] of points.x.entries()) {
    homes[index] = cellOf(points.y[index] ?? 0, domain.y, cells) * cells + cellOf(x, domain.x, cells);
  }

  const starts = new Int32Array(cells * cells + 1);

  for (const home of homes) {
    starts[home + 1] = (starts[home + 1] ?? 0) + 1;
  }

  for (const [cell, value] of starts.entries()) {
    starts[cell] = value + (starts[cell - 1] ?? 0);
  }

  const filled = starts.slice(0, -1);
  const order = new Int32Array(count);

  for (const [index, home] of homes.entries()) {
    const slot = filled[home] ?? 0;

    order[slot] = index;
    filled[home] = slot + 1;
  }

  return {
    nearest: ({ x, y, radiusX, radiusY }) => {
      const columns = span(cellOf(x - radiusX, domain.x, cells), cellOf(x + radiusX, domain.x, cells));
      const rows = span(cellOf(y - radiusY, domain.y, cells), cellOf(y + radiusY, domain.y, cells));

      const candidates = rows.flatMap((row) =>
        columns.flatMap((column) => {
          const cell = row * cells + column;

          return Array.from(order.subarray(starts[cell], starts[cell + 1]));
        }),
      );

      const hit = { index: -1, distance: 1 };

      for (const index of candidates) {
        const dx = ((points.x[index] ?? 0) - x) / radiusX;
        const dy = ((points.y[index] ?? 0) - y) / radiusY;
        const distance = dx * dx + dy * dy;

        if (distance <= hit.distance) {
          hit.index = index;
          hit.distance = distance;
        }
      }

      return hit.index < 0 ? undefined : hit.index;
    },
  };
}

/** How many points lie inside a rectangle, edges included. */
export function countInside(points: PointColumns, rect: DataRect): number {
  return points.x.filter((x, index) => {
    const y = points.y[index] ?? Number.NaN;

    const isBetweenSides = x >= rect.x[0] && x <= rect.x[1];
    const isBetweenEnds = y >= rect.y[0] && y <= rect.y[1];

    return isBetweenSides && isBetweenEnds;
  }).length;
}

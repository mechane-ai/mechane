/** One sized record to place: its id and a positive amount. */
export type AreaInput = { readonly id: string; readonly value: number };

/** A placed rectangle, from its top left corner (`x0`, `y0`) to its bottom right corner (`x1`, `y1`). */
export type AreaCell = {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

type Rect = Omit<AreaCell, 'id'>;

/** The aspect ratio squarified rows aim for: the golden ratio, as in the classic algorithm. */
const SQRT_FIVE = Math.sqrt(5);
const HALF = 0.5;
const TARGET_RATIO = (1 + SQRT_FIVE) * HALF;

function sum(items: ReadonlyArray<AreaInput>): number {
  return items.reduce((total, item) => total + item.value, 0);
}

/** How many of the first items share the next row: items join while the row's worst aspect ratio keeps improving. */
function rowLength(items: ReadonlyArray<AreaInput>, rect: Rect, remaining: number): number {
  const dx = rect.x1 - rect.x0;
  const dy = rect.y1 - rect.y0;
  const alpha = Math.max(dy / dx, dx / dy) / (remaining * TARGET_RATIO);

  const ratios = items.map((_, index) => {
    const row = items.slice(0, index + 1).map((item) => item.value);
    const rowSum = row.reduce((total, value) => total + value, 0);
    const beta = rowSum * rowSum * alpha;

    return Math.max(Math.max(...row) / beta, beta / Math.min(...row));
  });

  const worse = ratios.findIndex((ratio, index) => index > 0 && ratio > (ratios[index - 1] ?? ratio));

  return worse === -1 ? items.length : worse;
}

/** Splits a strip along its long side in proportion to each item's value. */
function strip(items: ReadonlyArray<AreaInput>, rect: Rect, isAcross: boolean): ReadonlyArray<AreaCell> {
  const total = sum(items);

  return items.map((item, index) => {
    const before = sum(items.slice(0, index));
    const start = total === 0 ? 0 : before / total;
    const end = total === 0 ? 0 : (before + item.value) / total;

    if (isAcross) {
      const width = rect.x1 - rect.x0;

      return { id: item.id, x0: rect.x0 + width * start, x1: rect.x0 + width * end, y0: rect.y0, y1: rect.y1 };
    }

    const height = rect.y1 - rect.y0;

    return { id: item.id, x0: rect.x0, x1: rect.x1, y0: rect.y0 + height * start, y1: rect.y0 + height * end };
  });
}

/** The space still to fill: the items not yet placed, the rectangle left for them and their sum. */
type Pending = { readonly items: ReadonlyArray<AreaInput>; readonly rect: Rect; readonly remaining: number };

/** Places one row in the pending space and returns its cells with the space left after it. */
function placeRow({ items, rect, remaining }: Pending): {
  readonly cells: ReadonlyArray<AreaCell>;
  readonly rest: Pending;
} {
  const count = rowLength(items, rect, remaining);
  const row = items.slice(0, count);
  const rowSum = sum(row);
  const share = remaining === 0 ? 1 : rowSum / remaining;
  const dx = rect.x1 - rect.x0;
  const dy = rect.y1 - rect.y0;
  const after = { items: items.slice(count), remaining: remaining - rowSum };

  // A tall space takes a row across its top; a wide one takes a column down its left side.
  if (dx < dy) {
    const edge = rect.y0 + dy * share;

    return { cells: strip(row, { ...rect, y1: edge }, true), rest: { ...after, rect: { ...rect, y0: edge } } };
  }

  const edge = rect.x0 + dx * share;

  return { cells: strip(row, { ...rect, x1: edge }, false), rest: { ...after, rect: { ...rect, x0: edge } } };
}

/**
 * Places row after row: each row's space is what the rows before it left.
 *
 * @yields The cells of each row, in supplied order.
 */
function* squarify(start: Pending): Generator<AreaCell> {
  const space = { pending: start };

  while (space.pending.items.length > 0) {
    const row = placeRow(space.pending);

    yield* row.cells;

    space.pending = row.rest;
  }
}

export type TreemapLayoutInput = {
  /** The records in supplied order. Each needs a positive value; leave out zero and missing ones. */
  readonly items: ReadonlyArray<AreaInput>;
  readonly width: number;
  readonly height: number;
  /** The gap between neighboring rectangles, in pixels. Rectangles at the edge touch it. */
  readonly gap?: number | undefined;
};

/**
 * A squarified treemap: rectangles whose areas are proportional to their values and whose shapes stay close to square,
 * laid out in supplied order without sorting. A pure function, so a server and a browser place alike.
 */
export function treemapLayout({ items, width, height, gap = 0 }: TreemapLayoutInput): ReadonlyArray<AreaCell> {
  const inset = gap * HALF;
  const outer = { x0: -inset, y0: -inset, x1: width + inset, y1: height + inset };

  return Array.from(squarify({ items, rect: outer, remaining: sum(items) }), (cell) => {
    const x0 = cell.x0 + inset;
    const x1 = cell.x1 - inset;
    const y0 = cell.y0 + inset;
    const y1 = cell.y1 - inset;

    return {
      id: cell.id,
      x0: x1 < x0 ? (x0 + x1) * HALF : x0,
      x1: x1 < x0 ? (x0 + x1) * HALF : x1,
      y0: y1 < y0 ? (y0 + y1) * HALF : y0,
      y1: y1 < y0 ? (y0 + y1) * HALF : y1,
    };
  });
}

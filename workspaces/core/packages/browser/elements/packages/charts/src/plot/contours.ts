/**
 * A surface sampled on a regular grid. `values` holds `columns * rows` samples, row by row. Each row starts at its left
 * edge and the first row is the bottom edge, so a row index grows upward like a value on a y axis.
 */
export type ContourGrid = { readonly columns: number; readonly rows: number; readonly values: ReadonlyArray<number> };

/** A place on the grid in sample units: whole numbers are samples, fractions lie between them. */
export type GridPoint = { readonly column: number; readonly row: number };

/** One piece of a level line, between two points on the edges of one grid cell. */
export type ContourSegment = { readonly from: GridPoint; readonly to: GridPoint };

type Edge = 'top' | 'right' | 'bottom' | 'left';

type Corners = {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
};

const QUARTER = 0.25;
const PRECISION = 10;
const LAST_CELL_OFFSET = 2;

/**
 * The edges a level line joins in one cell, keyed by which corners are at or above the level, in the order top left,
 * top right, bottom right, bottom left. The two saddle cells end in `+` or `-` for a center at or below the level.
 */
const cellEdges: Readonly<Record<string, ReadonlyArray<readonly [Edge, Edge]>>> = {
  '0000': [],
  '1111': [],
  '1000': [['left', 'top']],
  '0100': [['top', 'right']],
  '0010': [['right', 'bottom']],
  '0001': [['bottom', 'left']],
  '1100': [['left', 'right']],
  '0110': [['top', 'bottom']],
  '0011': [['left', 'right']],
  '1001': [['top', 'bottom']],
  '1110': [['bottom', 'left']],
  '1101': [['right', 'bottom']],
  '1011': [['top', 'right']],
  '0111': [['left', 'top']],
  '1010+': [
    ['top', 'right'],
    ['bottom', 'left'],
  ],
  '1010-': [
    ['left', 'top'],
    ['right', 'bottom'],
  ],
  '0101+': [
    ['left', 'top'],
    ['right', 'bottom'],
  ],
  '0101-': [
    ['top', 'right'],
    ['bottom', 'left'],
  ],
};

const saddles: ReadonlySet<string> = new Set(['1010', '0101']);

function cornerValues(grid: ContourGrid, column: number, row: number): Corners {
  function at(offsetColumn: number, offsetRow: number): number {
    return grid.values[(row + offsetRow) * grid.columns + column + offsetColumn] ?? Number.NaN;
  }

  return { topLeft: at(0, 1), topRight: at(1, 1), bottomRight: at(1, 0), bottomLeft: at(0, 0) };
}

function crossing(from: number, to: number, level: number): number {
  return (level - from) / (to - from);
}

type EdgePointInput = {
  readonly edge: Edge;
  readonly column: number;
  readonly row: number;
  readonly corners: Corners;
  readonly level: number;
};

function edgePoint({ edge, column, row, corners, level }: EdgePointInput): GridPoint {
  if (edge === 'top') {
    return { column: column + crossing(corners.topLeft, corners.topRight, level), row: row + 1 };
  }

  if (edge === 'bottom') {
    return { column: column + crossing(corners.bottomLeft, corners.bottomRight, level), row };
  }

  if (edge === 'left') {
    return { column, row: row + crossing(corners.bottomLeft, corners.topLeft, level) };
  }

  return { column: column + 1, row: row + crossing(corners.bottomRight, corners.topRight, level) };
}

/**
 * The line where a sampled surface crosses a level, by marching squares. Each grid cell with samples on both sides of
 * the level contributes one or two straight pieces, placed along its edges by linear interpolation between the two
 * samples. A saddle cell is resolved by the average of its four samples, and a sample equal to the level counts as
 * above.
 */
export function contourSegments({
  grid,
  level,
}: {
  readonly grid: ContourGrid;
  readonly level: number;
}): ReadonlyArray<ContourSegment> {
  const cells = Array.from({ length: Math.max(0, grid.rows - 1) }, (_, row) =>
    Array.from({ length: Math.max(0, grid.columns - 1) }, (__, column) => ({ column, row })),
  ).flat();

  return cells.flatMap(({ column, row }) => {
    const corners = cornerValues(grid, column, row);

    const bits = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]
      .map((value) => (value >= level ? '1' : '0'))
      .join('');

    const center = (corners.topLeft + corners.topRight + corners.bottomRight + corners.bottomLeft) * QUARTER;
    const key = saddles.has(bits) ? `${bits}${center >= level ? '+' : '-'}` : bits;

    return (cellEdges[key] ?? []).map(([first, second]) => ({
      from: edgePoint({ edge: first, column, row, corners, level }),
      to: edgePoint({ edge: second, column, row, corners, level }),
    }));
  });
}

/**
 * The surface at a place between samples, by linear interpolation along the grid's rows and columns. It is undefined
 * outside the grid.
 */
export function sampleGrid({
  grid,
  point,
}: {
  readonly grid: ContourGrid;
  readonly point: GridPoint;
}): number | undefined {
  const isColumnInside = point.column >= 0 && point.column <= grid.columns - 1;
  const isRowInside = point.row >= 0 && point.row <= grid.rows - 1;
  const isInside = isColumnInside && isRowInside;

  if (!isInside) {
    return undefined;
  }

  const column = Math.min(Math.floor(point.column), Math.max(0, grid.columns - LAST_CELL_OFFSET));
  const row = Math.min(Math.floor(point.row), Math.max(0, grid.rows - LAST_CELL_OFFSET));
  const corners = cornerValues(grid, column, row);
  const across = point.column - column;
  const up = point.row - row;
  const lower = corners.bottomLeft + (corners.bottomRight - corners.bottomLeft) * across;
  const upper = corners.topLeft + (corners.topRight - corners.topLeft) * across;

  return lower + (upper - lower) * up;
}

function coordinate(value: number): string {
  return String(Math.round(value * PRECISION) / PRECISION);
}

/** The SVG path of level-line pieces, each drawn from its own start, after `position` places grid points in pixels. */
export function segmentsPath({
  segments,
  position,
}: {
  readonly segments: ReadonlyArray<ContourSegment>;
  readonly position: (point: GridPoint) => { readonly x: number; readonly y: number };
}): string {
  return segments
    .map((segment) => {
      const from = position(segment.from);
      const to = position(segment.to);

      return `M${coordinate(from.x)},${coordinate(from.y)}L${coordinate(to.x)},${coordinate(to.y)}`;
    })
    .join('');
}

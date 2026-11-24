import type { NumericDomain } from '../../../../charts/src/index.ts';
import type { HeatmapPalette } from '../../../../charts/src/matrix/index.ts';
import type { SceneOffset } from '../scene-geometry.ts';

/** The pixel boxes of the named cell sizes. */
export const sceneCellSizes = {
  small: { width: 40, height: 28 },
  medium: { width: 56, height: 36 },
  large: { width: 76, height: 46 },
} as const;

/** A named cell size. */
export type SceneCellSizeName = keyof typeof sceneCellSizes;

/** The pixels between neighbouring cells. */
export const cellGap = 2;

/** One cell as the author describes it. */
export type SceneCellInput = {
  /** Overrides the cell's id, `${grid id}.${row}.${column}`, for a cell whose identity must survive a reorder. */
  readonly id?: string | undefined;
  /** What the cell shows instead of its formatted value, such as a word or a symbol. */
  readonly text?: string | undefined;
  /** The cell's number. It eases when it changes, and it sets the cell's color. */
  readonly value?: number | undefined;
  /** The readout sentence. Left out, the cell says its row, column and value. */
  readonly label?: string | undefined;
};

/** The numbers of a vector or a matrix: a flat list, or a list of rows. */
export type SceneCellValues = ReadonlyArray<number | ReadonlyArray<number>>;

/** Which way a flat list of values runs. */
export type SceneCellsDirection = 'row' | 'column';

const HALF = 0.5;

function rowOf(item: number | ReadonlyArray<number>): ReadonlyArray<number> {
  return typeof item === 'number' ? [item] : item;
}

/** The grid of cells an author described: rows of cells. A flat list of values becomes one row, or one column. */
export function cellGrid({
  values,
  cells,
  direction,
}: {
  readonly values: SceneCellValues | undefined;
  readonly cells: ReadonlyArray<ReadonlyArray<SceneCellInput>> | undefined;
  readonly direction: SceneCellsDirection;
}): ReadonlyArray<ReadonlyArray<SceneCellInput>> {
  if (cells !== undefined) {
    return cells;
  }

  const numbers = (values ?? []).map(rowOf);
  const isFlat = (values ?? []).every((item) => typeof item === 'number');
  const rows = isFlat && direction === 'row' ? [numbers.flat()] : numbers;

  return rows.map((row) => row.map((value) => ({ value })));
}

/** The pixel box of a grid of `rows` by `columns` cells. */
export function cellsExtent({
  rows,
  columns,
  size,
}: {
  readonly rows: number;
  readonly columns: number;
  readonly size: SceneCellSizeName;
}): { readonly width: number; readonly height: number } {
  const box = sceneCellSizes[size];

  return {
    width: columns * box.width + Math.max(columns - 1, 0) * cellGap,
    height: rows * box.height + Math.max(rows - 1, 0) * cellGap,
  };
}

/** A cell's center as a shift in pixels from the grid's center: across to the right, then down. */
export function cellOffset({
  row,
  column,
  rows,
  columns,
  size,
}: {
  readonly row: number;
  readonly column: number;
  readonly rows: number;
  readonly columns: number;
  readonly size: SceneCellSizeName;
}): SceneOffset {
  const box = sceneCellSizes[size];

  return [(column - (columns - 1) * HALF) * (box.width + cellGap), (row - (rows - 1) * HALF) * (box.height + cellGap)];
}

/**
 * The values the color scale spans: the one the author gave, or zero to the largest magnitude, or its mirror for a
 * diverging palette.
 */
export function cellsDomain({
  grid,
  palette,
  domain,
}: {
  readonly grid: ReadonlyArray<ReadonlyArray<SceneCellInput>>;
  readonly palette: HeatmapPalette | undefined;
  readonly domain: NumericDomain | undefined;
}): NumericDomain {
  if (domain !== undefined) {
    return domain;
  }

  const largest = Math.max(0, ...grid.flatMap((row) => row.map((cell) => Math.abs(cell.value ?? 0))));
  const reach = largest === 0 ? 1 : largest;

  return palette === 'diverging' ? [-reach, reach] : [0, reach];
}

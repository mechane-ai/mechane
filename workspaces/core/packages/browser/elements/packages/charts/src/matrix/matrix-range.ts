import { cellsToText } from '@ui-sdk/core';
import type { CellBounds } from '@ui-sdk/core';
import type { MatrixAxisItem, MatrixCellRange, MatrixCoordinate } from './matrix-types.ts';

/** The rows and columns a range is measured against, in drawn order. */
export type RangeAxes = {
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
};

function indexOf(items: ReadonlyArray<MatrixAxisItem>, id: string): number {
  return items.findIndex((item) => item.id === id);
}

/** Why a supplied range cannot be drawn, or undefined when every corner names a supplied row and column. */
export function rangeProblem(range: MatrixCellRange | null, { rows, columns }: RangeAxes): string | undefined {
  if (range === null) {
    return undefined;
  }

  const corners = [range.anchor, range.end];
  const isKnown = corners.every((corner) => indexOf(rows, corner.rowId) >= 0 && indexOf(columns, corner.columnId) >= 0);

  return isKnown ? undefined : 'The cell range must refer to a supplied row and column at both corners.';
}

/** The inclusive rows and columns a range covers, from zero. */
export function rangeBounds(range: MatrixCellRange, { rows, columns }: RangeAxes): CellBounds {
  const anchorRow = indexOf(rows, range.anchor.rowId);
  const endRow = indexOf(rows, range.end.rowId);
  const anchorColumn = indexOf(columns, range.anchor.columnId);
  const endColumn = indexOf(columns, range.end.columnId);

  return {
    top: Math.min(anchorRow, endRow),
    bottom: Math.max(anchorRow, endRow),
    left: Math.min(anchorColumn, endColumn),
    right: Math.max(anchorColumn, endColumn),
  };
}

/** Whether a coordinate lies inside the bounds. */
export function isInBounds(bounds: CellBounds, row: number, column: number): boolean {
  const isRowInside = row >= bounds.top && row <= bounds.bottom;
  const isColumnInside = column >= bounds.left && column <= bounds.right;

  return isRowInside && isColumnInside;
}

const rowSteps: Readonly<Record<string, number | undefined>> = { ArrowUp: -1, ArrowDown: 1 };
const columnSteps: Readonly<Record<string, number | undefined>> = { ArrowLeft: -1, ArrowRight: 1 };

export type RangeKeyInput = RangeAxes & {
  readonly key: string;
  readonly range: MatrixCellRange | null;
  /** The keyboard cursor, where a new range starts. */
  readonly from: MatrixCoordinate;
  /** True in right-to-left text, where Left and Right swap. */
  readonly isReversed: boolean;
};

/**
 * The range after Shift with a key: an arrow grows or shrinks it by one cell from its far corner, Home and End take it
 * to the row's ends. Undefined for any other key. The far corner stops at the matrix's edges.
 */
export function extendRange({
  key,
  range,
  from,
  isReversed,
  rows,
  columns,
}: RangeKeyInput): MatrixCellRange | undefined {
  const anchor = range?.anchor ?? from;
  const end = range?.end ?? from;
  const row = indexOf(rows, end.rowId);
  const column = indexOf(columns, end.columnId);
  const lastColumn = columns.length - 1;
  const flip = isReversed ? -1 : 1;

  const targets: Readonly<Record<string, number | undefined>> = { Home: 0, End: lastColumn };
  const columnStep = columnSteps[key];
  const rowStep = rowSteps[key] ?? 0;
  const target = targets[key] ?? (columnStep === undefined ? undefined : column + columnStep * flip);

  if (target === undefined && rowSteps[key] === undefined) {
    return undefined;
  }

  const nextRow = rows[Math.max(0, Math.min(rows.length - 1, row + rowStep))];
  const nextColumn = columns[Math.max(0, Math.min(lastColumn, target ?? column))];

  if (nextRow === undefined || nextColumn === undefined) {
    return undefined;
  }

  return { anchor, end: { rowId: nextRow.id, columnId: nextColumn.id } };
}

/** The range that covers every row and column. */
export function wholeRange({ rows, columns }: RangeAxes): MatrixCellRange | undefined {
  const [firstRow, lastRow, firstColumn, lastColumn] = [rows[0], rows.at(-1), columns[0], columns.at(-1)];

  if (firstRow === undefined || lastRow === undefined) {
    return undefined;
  }

  if (firstColumn === undefined || lastColumn === undefined) {
    return undefined;
  }

  return {
    anchor: { rowId: firstRow.id, columnId: firstColumn.id },
    end: { rowId: lastRow.id, columnId: lastColumn.id },
  };
}

export type RangeTextInput = RangeAxes & {
  readonly bounds: CellBounds;
  /** A cell's exact value as copied text: empty for a cell with no value. */
  readonly read: (coordinate: MatrixCoordinate) => string;
};

/** The range's exact values as tab-separated text, one line per row, ready to paste into a spreadsheet. */
export function rangeText({ bounds, rows, columns, read }: RangeTextInput): string {
  const lines = rows
    .slice(bounds.top, bounds.bottom + 1)
    .map((row) =>
      columns.slice(bounds.left, bounds.right + 1).map((column) => read({ rowId: row.id, columnId: column.id })),
    );

  return cellsToText(lines.map((line) => [...line]));
}

type Span = {
  readonly items: ReadonlyArray<MatrixAxisItem>;
  readonly from: number;
  readonly to: number;
  readonly noun: string;
};

function span({ items, from, to, noun }: Span): string {
  const first = items[from]?.label ?? '';
  const last = items[to]?.label ?? '';

  return from === to ? `${noun} ${first}` : `${noun}s ${first} to ${last}`;
}

export type RangeSummaryInput = RangeAxes & {
  readonly bounds: CellBounds;
  /** How many drawn cells the range holds. */
  readonly count: number;
  /** What a row and a column are called in this matrix: "actual class", "predicted class". */
  readonly rowNoun?: string | undefined;
  readonly columnNoun?: string | undefined;
};

/** The range as a reader hears it: "6 cells selected: rows Cat to Dog, columns Bird to Fish". */
export function rangeSummary({
  bounds,
  rows,
  columns,
  count,
  rowNoun = 'row',
  columnNoun = 'column',
}: RangeSummaryInput): string {
  const cells = count === 1 ? '1 cell' : `${count} cells`;

  return `${cells} selected: ${span({ items: rows, from: bounds.top, to: bounds.bottom, noun: rowNoun })}, ${span({ items: columns, from: bounds.left, to: bounds.right, noun: columnNoun })}`;
}

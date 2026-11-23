import type { CellRangeReason } from '@ui-sdk/core';

/** A row or a column of a matrix, with the identity selection and linked views use. */
export type MatrixAxisItem = {
  readonly id: string;
  /** The full name used in headers, inspection and exact values. */
  readonly label: string;
  /** A concise header, such as "J" for January, that a compact strip shows. Absent uses the label. */
  readonly axisLabel?: string | undefined;
};

/**
 * One supplied coordinate: a measured value, a value masked by the analysis (such as a future token), or a value that
 * was not recorded. Masked and missing cells name their reason, and neither is ever drawn as zero.
 */
export type MatrixCell = { readonly id: string; readonly rowId: string; readonly columnId: string } & (
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'masked'; readonly reason: string }
  | { readonly kind: 'missing'; readonly reason: string }
);

/** A coordinate of a matrix, by its row and column identities. */
export type MatrixCoordinate = { readonly rowId: string; readonly columnId: string };

/**
 * A rectangular block of cells the reader marked for copying or comparison: from the cell it started at to the cell it
 * reaches, inclusive. It is application state, held by identity so it survives a reorder of rows or columns.
 */
export type MatrixCellRange = { readonly anchor: MatrixCoordinate; readonly end: MatrixCoordinate };

/** Why the range changed: Shift with an arrow key, a Shift press on a cell, a drag across cells, or Escape. */
export type MatrixCellRangeDetails = { readonly reason: CellRangeReason; readonly event?: Event | undefined };

/** The application's cell range and its request to change it. Without the callback, the matrix offers no range. */
export type MatrixCellRangeProps = {
  readonly cellRange?: MatrixCellRange | null | undefined;
  readonly onCellRangeChange?: ((range: MatrixCellRange | null, details: MatrixCellRangeDetails) => void) | undefined;
};

/** Whether square cells write their values, for one large matrix or many small ones. */
export type MatrixCellValuesProps = {
  /**
   * A `shown` value writes each cell's value inside it, in a shorter form when the cell is small. A `hidden` value
   * draws color only, with smaller cells, for small multiples such as one panel per attention head. The readout and the
   * exact-value table still give every value, and absent means shown.
   */
  readonly cellValues?: 'shown' | 'hidden' | undefined;
};

/** The identity a preset gives the cell at a coordinate, for `selected` and `onSelectedChange`. */
export function matrixCellId(rowId: string, columnId: string): string {
  return JSON.stringify([rowId, columnId]);
}

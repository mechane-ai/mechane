import { hasUniqueIds } from '../chart-input.ts';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import type { MatrixAxisItem, MatrixCellRangeProps } from './matrix-types.ts';

/** What every matrix preset accepts besides its own data: the figure, the selected cell and the cell range. */
export type MatrixPresetProps = FigureProps & FigureSelectionProps & MatrixCellRangeProps;

export type DenseInput = {
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
  /** One line per row, one value per column. */
  readonly values: ReadonlyArray<ReadonlyArray<number | null>>;
  /** What rows and columns are called in the messages: "classes", "variables". */
  readonly noun: string;
  /** The largest number of rows or columns the preset draws. */
  readonly limit: number;
};

/** Why a row-by-column table of values cannot be drawn: too large, duplicate identities or a ragged shape. */
export function denseProblem({ rows, columns, values, noun, limit }: DenseInput): string | undefined {
  if (rows.length > limit || columns.length > limit) {
    return `This matrix draws at most ${limit} ${noun} on each side. Supply a smaller, labelled window.`;
  }

  if (!hasUniqueIds(rows) || !hasUniqueIds(columns)) {
    return `Matrix ${noun} must have unique identifiers.`;
  }

  const isShaped = values.length === rows.length && values.every((line) => line.length === columns.length);

  return isShaped ? undefined : `Supply one line of values per row and one value per column, for every ${noun}.`;
}

/** The value at a row and column of a dense table, or null where the line holds none. */
export function denseValue(values: DenseInput['values'], row: number, column: number): number | null {
  return values[row]?.[column] ?? null;
}

/** Token text with each space, newline and tab drawn as a visible symbol, for a header. Readouts quote exact text. */
export function visibleText(text: string): string {
  return text.replaceAll(' ', '␣').replaceAll('\n', '⏎').replaceAll('\t', '⇥');
}

import type { PlotBox } from '../plot/plot-layout.ts';

const HALF = 0.5;
const CHARACTER_WIDTH = 7;
const COLUMN_LABEL_GAP = 16;

export type ColumnPositionsInput = {
  readonly box: PlotBox;
  /** The column labels under the axis, one per column, in order. */
  readonly columnLabels: ReadonlyArray<string>;
  /** The room the labels beside the first and last column ask for at the left and right ends of the plot. */
  readonly leftGutter: number;
  readonly rightGutter: number;
};

/** Evenly spaced columns, and the end gutters they leave for the labels beside the first and last column. */
export type ColumnPositions = {
  readonly xs: ReadonlyArray<number>;
  readonly leftGutter: number;
  readonly rightGutter: number;
};

/**
 * Evenly spaced columns between the gutters that hold the end labels. When the plot is too narrow for both, the gutters
 * give up room in proportion to their size, up to half the plot. This keeps neighbouring column labels from touching,
 * and an end label then shortens.
 */
export function columnPositions({ box, columnLabels, leftGutter, rightGutter }: ColumnPositionsInput): ColumnPositions {
  const count = columnLabels.length;
  const longest = Math.max(0, ...columnLabels.map((label) => label.length));
  const span = Math.min((count - 1) * (longest * CHARACTER_WIDTH + COLUMN_LABEL_GAP), box.innerWidth * HALF);
  const asked = leftGutter + rightGutter;
  const share = asked > 0 ? Math.min(1, Math.max(0, box.innerWidth - span) / asked) : 1;
  const left = leftGutter * share;
  const right = rightGutter * share;
  const first = box.left + left;
  const room = Math.max(0, box.right - right - first);

  return {
    xs: Array.from({ length: count }, (_, index) => first + (count > 1 ? (room * index) / (count - 1) : room * HALF)),
    leftGutter: left,
    rightGutter: right,
  };
}

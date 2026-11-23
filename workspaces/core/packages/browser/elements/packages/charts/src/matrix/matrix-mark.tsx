import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import { ChartMark } from '../chart.tsx';
import type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

/** How a preset marks a coordinate: left blank, outlined (a confusion diagonal), or drawn in gray as context. */
export type MatrixMarking = 'hidden' | 'outlined' | 'context';

/** One drawn coordinate as both matrix drawings read it. */
export type MatrixCellView = {
  /** The chart item id: the supplied cell's id, or the coordinate's id where no cell was supplied. */
  readonly id: string;
  readonly row: MatrixAxisItem;
  readonly column: MatrixAxisItem;
  readonly cell: MatrixCell | undefined;
  /** The full sentence: coordinate and exact value. */
  readonly label: string;
  /** The square cell's text: its short value or its state glyph. */
  readonly glyph: string;
  readonly fill: string | undefined;
  readonly isOutside: boolean;
  readonly marking: MatrixMarking | undefined;
  /** The range's outer edges this cell draws, as an inset shadow. */
  readonly edges: string | undefined;
  readonly isSelected: boolean;
  readonly isInspected: boolean;
  readonly isCursor: boolean;
};

const styles = stylex.create({
  interactive: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':active': { borderColor: colors.ink },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
    ':hover': { borderColor: { [conditions.hoverPointer]: colors.ink } },
  },
  marked: { outlineWidth: controls.focusWidth, outlineColor: colors.focus, outlineStyle: 'solid', outlineOffset: -2 },
  edges: (shadow: string) => ({ boxShadow: shadow }),
});

export type MatrixMarkProps = {
  readonly view: MatrixCellView;
  /** True when the application takes selection requests: a supplied cell is then a button. */
  readonly isSelectable: boolean;
  readonly appearance: ReadonlyArray<stylex.StyleXStyles | false | undefined>;
  readonly children?: ReactNode;
};

/** One inspectable matrix cell with its range edges, selection and keyboard cursor, in either drawing. */
export function MatrixMark({ view, isSelectable, appearance, children }: MatrixMarkProps): ReactNode {
  const isMarked = view.isInspected || view.isSelected;
  const isButton = isSelectable && view.cell !== undefined;

  return (
    <ChartMark
      value={view.id}
      data-matrix-row={view.row.id}
      data-matrix-column={view.column.id}
      render={isButton ? <button type="button" tabIndex={-1} aria-pressed={view.isSelected} /> : <span role="img" />}
      aria-label={view.label}
      title={view.label}
      {...stylex.props(
        ...appearance,
        isButton && styles.interactive,
        view.edges !== undefined && styles.edges(view.edges),
        isMarked && styles.marked,
        !isMarked && view.isCursor && chartStyles.cursor,
      )}
    >
      {children}
    </ChartMark>
  );
}

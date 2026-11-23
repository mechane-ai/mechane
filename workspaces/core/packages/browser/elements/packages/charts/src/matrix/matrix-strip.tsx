import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { MatrixMark } from './matrix-mark.tsx';
import type { MatrixCellView } from './matrix-mark.tsx';
import type { MatrixAxisItem } from './matrix-types.ts';

const styles = stylex.create({
  grid: (columnCount: number) => ({
    display: 'grid',
    gridTemplateColumns: `minmax(48px, max-content) repeat(${columnCount}, minmax(14px, 1fr))`,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
    alignItems: 'center',
    minWidth: 0,
    fontFamily: typography.fontFamily,
  }),
  header: {
    minWidth: 0,
    whiteSpace: 'nowrap',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  title: { color: colors.ink, fontWeight: typography.mediumWeight },
  columnTitle: { gridColumn: '2 / -1' },
  row: { display: 'contents' },
  rowLabel: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingInlineEnd: spacing.sm,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    width: '100%',
    height: { default: 22, [conditions.coarsePointer]: 32 },
    margin: 0,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: 1,
  },
  measured: (color: string) => ({ backgroundImage: `linear-gradient(${color}, ${color})` }),
  empty: { backgroundColor: colors.canvas },
  dashed: { borderStyle: 'dashed', borderColor: colors.faint, backgroundColor: colors.canvas },
  outlined: { borderColor: colors.ink },
  blank: { height: 0 },
});

const headerStyles = stylex.create({
  clip: { overflow: 'hidden', textOverflow: 'clip', textAlign: 'center' },
  overflow: { overflow: 'visible', textAlign: 'start' },
});

const fonts = stylex.create({ text: {}, mono: { fontFamily: typography.monoFamily, whiteSpace: 'pre' } });

export type MatrixStripProps = {
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
  readonly rowTitle?: string | undefined;
  readonly columnTitle?: string | undefined;
  readonly font: 'text' | 'mono';
  readonly headers: 'clip' | 'overflow';
  /** The drawn cell at a coordinate, or undefined where the matrix leaves a blank. */
  readonly viewAt: (rowId: string, columnId: string) => MatrixCellView | undefined;
  readonly isSelectable: boolean;
};

function appearance(view: MatrixCellView): ReadonlyArray<stylex.StyleXStyles | false> {
  const state = view.cell === undefined || view.cell.kind === 'masked' ? styles.empty : styles.dashed;

  return [
    styles.cell,
    view.fill === undefined ? state : styles.measured(view.fill),
    view.marking === 'outlined' && styles.outlined,
  ];
}

/** The strip shows color and state glyphs only; inspection and the exact-value table hold the numbers. */
function stripGlyph(view: MatrixCellView): string {
  return view.cell?.kind === 'value' && !view.isOutside ? '' : view.glyph;
}

/**
 * Draws a matrix as compact intensity rows that fill the available width, such as months across categories or weeks
 * across weekdays.
 */
export function MatrixStrip({
  rows,
  columns,
  rowTitle,
  columnTitle,
  font,
  headers,
  viewAt,
  isSelectable,
}: MatrixStripProps): ReactNode {
  return (
    <div {...stylex.props(styles.grid(columns.length))}>
      {columnTitle !== undefined && (
        <>
          <span aria-hidden />
          <span aria-hidden {...stylex.props(styles.header, styles.title, styles.columnTitle)}>
            {columnTitle}
          </span>
        </>
      )}
      <span aria-hidden {...stylex.props(styles.header, styles.title)}>
        {rowTitle}
      </span>
      {columns.map((column) => (
        <span
          key={column.id}
          aria-hidden
          title={column.label}
          {...stylex.props(styles.header, headerStyles[headers], fonts[font])}
        >
          {column.axisLabel ?? column.label}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row.id} {...stylex.props(styles.row)}>
          <span aria-hidden title={row.label} {...stylex.props(styles.rowLabel, fonts[font])}>
            {row.label}
          </span>
          {columns.map((column) => {
            const view = viewAt(row.id, column.id);

            return view === undefined ? (
              <span key={column.id} aria-hidden {...stylex.props(styles.blank)} />
            ) : (
              <MatrixMark key={column.id} view={view} isSelectable={isSelectable} appearance={appearance(view)}>
                {stripGlyph(view)}
              </MatrixMark>
            );
          })}
        </div>
      ))}
    </div>
  );
}

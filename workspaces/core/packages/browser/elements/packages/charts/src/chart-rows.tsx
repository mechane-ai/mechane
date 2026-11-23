import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { ChartMark, ChartPlot, inspectedLabel, plotLabel } from './chart.tsx';
import type { ChartItem, ChartView } from './chart.tsx';

const styles = stylex.create({
  rows: { minWidth: 0, outlineStyle: 'none' },
  datum: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    minWidth: 0,
    minHeight: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    boxSizing: 'border-box',
    width: '100%',
    borderWidth: 0,
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontWeight: typography.regularWeight,
    lineHeight: typography.bodyLineHeight,
    textAlign: 'start',
    overflowWrap: 'anywhere',
    color: colors.ink,
    backgroundColor: colors.surface,
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
  },
  selected: { backgroundColor: colors.canvas, boxShadow: shadows.selection },
  /** The row the arrow keys rest on. It is the focus ring of the rows, which are one Tab stop. */
  cursor: {
    outlineColor: { 'default': colors.focus, '@media (forced-colors: active)': 'Highlight' },
    outlineWidth: controls.focusWidth,
    outlineStyle: { default: 'none', [stylex.when.ancestor(':focus-visible')]: 'solid' },
    outlineOffset: -2,
  },
});

/**
 * The rows of a chart whose exact values are visible text, such as ranked bars. Rows an application can select are one
 * Tab stop: arrow keys move between them and Enter or Space selects. Rows it cannot select stay plain text.
 */
export function ChartRows({
  title,
  items,
  view,
  children,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<ChartItem>;
  /** The chart's view when its rows can be selected. */
  readonly view: ChartView | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const readoutId = useId();

  if (view === undefined) {
    return children;
  }

  return (
    <ChartPlot
      role="group"
      aria-label={plotLabel({ title, marks: 'rows', isSelectable: true })}
      aria-describedby={readoutId}
      {...stylex.props(styles.rows, stylex.defaultMarker())}
    >
      {children}
      <span id={readoutId} {...stylex.props(accessibility.hidden)}>
        {inspectedLabel(items, view.inspected)}
      </span>
    </ChartPlot>
  );
}

/** One row inside `ChartRows`. With the chart's view it is a mark a reader can select; without, it is text. */
export function ChartDatum({
  id,
  label,
  view,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly view: ChartView | undefined;
  readonly children: ReactNode;
}): ReactNode {
  if (view === undefined) {
    return <div {...stylex.props(styles.datum)}>{children}</div>;
  }

  const isSelected = view.selected === id;

  return (
    <ChartMark
      value={id}
      render={<button type="button" tabIndex={-1} aria-label={label} aria-pressed={isSelected} />}
      {...stylex.props(styles.datum, styles.action, isSelected && styles.selected, view.cursor === id && styles.cursor)}
    >
      {children}
    </ChartMark>
  );
}

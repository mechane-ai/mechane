import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import { Children, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, pageGeometry, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { ChartHeading } from './chart-heading.tsx';
import { ChartSeriesMarker } from './chart-series-marker.tsx';
import { ChartSeriesSummary } from './chart-series-summary.tsx';
import type { ChartLegendItem } from './chart-theme.ts';
import { useIsCaptioned } from './figure/caption-scope.tsx';

type ChartReportHeading = { readonly meta?: ReactNode; readonly actions?: ReactNode };

export type ChartReport = ChartReportHeading & { readonly summary?: ReactNode; readonly seriesValues?: never };

export type ChartSeriesReport =
  | ChartReport
  | (ChartReportHeading & {
      readonly summary?: never;
      readonly seriesValues: Readonly<Record<string, string | undefined>>;
    });

export type ChartFrameProps = {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  readonly report?: ChartSeriesReport | undefined;
  readonly series?: ReadonlyArray<ChartLegendItem> | undefined;
  /** The chart part's own props, when this figure is the root of an interactive chart. */
  readonly figure?: ComponentProps<'figure'> | undefined;
  /**
   * The legend that names what the plot draws, such as series, models or classes. It sits above the plot, directly
   * under the title block, with the frame's standard gap.
   */
  readonly seriesLegend?: ReactNode;
  /** The legend that explains a color or size scale. It sits directly below the plot, above the readout and notes. */
  readonly scaleLegend?: ReactNode;
};

export type { ChartLegendItem } from './chart-theme.ts';

export type ChartLegendProps = {
  readonly items: ReadonlyArray<ChartLegendItem>;
  readonly label?: string | undefined;
  readonly isScrollable?: boolean | undefined;
};

const styles = stylex.create({
  frame: {
    minWidth: 0,
    margin: 0,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontWeight: typography.regularWeight,
    lineHeight: typography.bodyLineHeight,
  },
  report: { borderWidth: 1, borderStyle: 'solid', borderColor: colors.line },
  reportBody: { minWidth: 0, padding: pageGeometry.inset },
  summary: { marginBlockEnd: spacing.lg, minWidth: 0 },
  heading: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: spacing.md,
    paddingBlockEnd: spacing.lg,
  },
  unprinted: { paddingBlockEnd: 0 },
  title: { flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' },
  caption: {
    margin: 0,
    fontSize: typography.inputSize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.strongWeight,
  },
  description: {
    margin: 0,
    marginBlockStart: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  /** The named legend's slot: the same gap to the plot in every chart. */
  legendSlot: { minWidth: 0, marginBlockEnd: spacing.sm },
  /** The scale legend's slot, under the plot. */
  scaleSlot: { minWidth: 0, marginBlockStart: spacing.sm },
  footer: {
    marginBlockStart: spacing.md,
    minWidth: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  scrollLegend: { flexWrap: 'nowrap', overflowX: 'auto', minHeight: typography.captionLineHeight },
  scrollItem: { flexShrink: 0, maxWidth: 'none', whiteSpace: 'nowrap' },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
    maxWidth: '100%',
    overflowWrap: 'anywhere',
  },
  readout: {
    margin: 0,
    minWidth: 0,
    height: typography.captionLineHeight,
    minHeight: typography.captionLineHeight,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

/**
 * The figure every chart draws in: the title block, the named legend, the plot, the scale legend, then the footer with
 * the readout and notes. Use `FigureFrame`, which builds it, in a chart.
 */
export function ChartFrame({
  title,
  description,
  children,
  actions,
  footer,
  report,
  series = [],
  figure = {},
  seriesLegend,
  scaleLegend,
}: ChartFrameProps): ReactNode {
  const titleId = useId();
  const isHeadingUnprinted = useIsCaptioned() && actions === undefined;

  const body = (
    <>
      {seriesLegend !== undefined && <div {...stylex.props(styles.legendSlot)}>{seriesLegend}</div>}
      {children}
      {scaleLegend !== undefined && <div {...stylex.props(styles.scaleSlot)}>{scaleLegend}</div>}
      {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </>
  );

  if (report !== undefined) {
    const summary =
      report.seriesValues === undefined ? (
        report.summary
      ) : (
        <ChartSeriesSummary series={series} values={report.seriesValues} />
      );

    const hasSummary = summary !== undefined && summary !== null && summary !== false;
    const hasCaptionActions = Children.toArray([report.actions, actions]).length > 0;

    const captionActions = (
      <>
        {report.actions}
        {actions}
      </>
    );

    return (
      <figure {...mergeProps(figure, { 'aria-labelledby': titleId }, stylex.props(styles.frame, styles.report))}>
        <figcaption>
          <ChartHeading id={titleId} title={title} meta={report.meta} actions={hasCaptionActions && captionActions} />
        </figcaption>
        <div {...stylex.props(styles.reportBody)}>
          {hasSummary && <div {...stylex.props(styles.summary)}>{summary}</div>}
          {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
          {body}
        </div>
      </figure>
    );
  }

  return (
    <figure {...mergeProps(figure, { 'aria-labelledby': titleId }, stylex.props(styles.frame))}>
      <figcaption {...stylex.props(styles.heading, isHeadingUnprinted && styles.unprinted)}>
        <div {...stylex.props(styles.title)}>
          <p id={titleId} {...stylex.props(styles.caption)}>
            {title}
          </p>
          {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
        </div>
        {actions !== undefined && <div {...stylex.props(headerStyles.actions)}>{actions}</div>}
      </figcaption>
      {body}
    </figure>
  );
}

/** The legend that names a chart's series or groups, each with its mark. Hand it to the frame's `seriesLegend` slot. */
export function ChartLegend({ items, label = 'Legend', isScrollable = false }: ChartLegendProps): ReactNode {
  return (
    <ul aria-label={label} {...stylex.props(styles.legend, isScrollable && styles.scrollLegend)}>
      {items.map((item) => (
        <li key={item.id} {...stylex.props(styles.legendItem, isScrollable && styles.scrollItem)}>
          <ChartSeriesMarker tone={item.tone} shape={item.shape} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** The line that states the inspected mark's exact values. A plot names it with `aria-describedby`. */
export function ChartReadout({ children, id }: { readonly children: ReactNode; readonly id?: string }): ReactNode {
  return (
    <p id={id} {...stylex.props(styles.readout)}>
      {children}
    </p>
  );
}

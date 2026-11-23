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
import type { ChartSelectDetails } from './chart.tsx';

type ChartReportHeading = { readonly meta?: ReactNode; readonly actions?: ReactNode };

export type ChartReport = ChartReportHeading & { readonly summary?: ReactNode; readonly seriesValues?: never };

export type ChartSeriesReport =
  | ChartReport
  | (ChartReportHeading & {
      readonly summary?: never;
      readonly seriesValues: Readonly<Record<string, string | undefined>>;
    });

export type ChartSelection = {
  readonly selectedId: string | undefined;
  /** The details say why and how: a press, a key or an agent's step. */
  readonly onSelect: (id: string, details: ChartSelectDetails) => void;
};

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
    minHeight: typography.captionLineHeight,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
});

export function ChartFrame({
  title,
  description,
  children,
  actions,
  footer,
  report,
  series = [],
  figure = {},
}: ChartFrameProps): ReactNode {
  const titleId = useId();

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
          {children}
          {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
        </div>
      </figure>
    );
  }

  return (
    <figure {...mergeProps(figure, { 'aria-labelledby': titleId }, stylex.props(styles.frame))}>
      <figcaption {...stylex.props(styles.heading)}>
        <div {...stylex.props(styles.title)}>
          <p id={titleId} {...stylex.props(styles.caption)}>
            {title}
          </p>
          {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
        </div>
        {actions !== undefined && <div {...stylex.props(headerStyles.actions)}>{actions}</div>}
      </figcaption>
      {children}
      {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </figure>
  );
}

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

export function ChartReadout({ children, id }: { readonly children: ReactNode; readonly id?: string }): ReactNode {
  return (
    <p id={id} {...stylex.props(styles.readout)}>
      {children}
    </p>
  );
}

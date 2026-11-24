import * as stylex from '@stylexjs/stylex';
import { formatNumber } from '@ui-sdk/core/number';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '../../../core/src/index.ts';
import { Notice, Skeleton } from '../../../feedback/src/index.ts';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartLegendItem } from '../chart-frame.tsx';
import { ChartInspectionTitle } from '../chart-inspection.tsx';
import { plotHeights } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { useIsCaptioned } from './caption-scope.tsx';
import type { FigureCoverage, FigureFrameInput } from './figure-props.ts';

const styles = stylex.create({
  title: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.sm,
    rowGap: spacing.xs,
  },
  footnote: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  note: { margin: 0, minWidth: 0, overflowWrap: 'anywhere' },
  compactDetail: {
    display: { default: 'none', [conditions.compactText]: 'block' },
    margin: 0,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  empty: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
});

const compact = { notation: 'compact', compactDisplay: 'long' } as const;
const COMPACT_FROM = 100_000;

function count(value: number, locale: string): string {
  return formatNumber(value, locale, value < COMPACT_FROM ? {} : compact);
}

/** "1,000 of 1.2 million points shown": the sentence a partial figure states beside its title. */
export function coverageText(coverage: FigureCoverage, locale: string): string {
  return `${count(coverage.shown, locale)} of ${count(coverage.total, locale)} ${coverage.unit} shown`;
}

export type FigureFrameProps = FigureFrameInput & {
  /** The chart part's own props, when this figure is the root of an interactive chart. */
  readonly figure?: ComponentProps<'figure'> | undefined;
  /** The series a report's period summary names. */
  readonly series?: ReadonlyArray<ChartLegendItem> | undefined;
  /**
   * What the reader is inspecting, in a few words. At phone width, where the floating inspector is hidden, the heading
   * shows it in place of the title.
   */
  readonly titleDetail?: string | undefined;
  /** The readout and any other line the chart keeps under its plot, above the footnote. */
  readonly footer?: ReactNode;
  /**
   * The legend that names things: series, models, classes. The frame sets it above the plot, directly under the title
   * block, with the standard gap. A chart never places such a legend among its own children.
   */
  readonly seriesLegend?: ReactNode;
  /** The legend that explains a color or size scale. The frame sets it directly below the plot. */
  readonly scaleLegend?: ReactNode;
  readonly children: ReactNode;
};

/**
 * The frame every figure shares: title, description, the plot, then the readout and one footnote. The footnote names
 * the source, how much of the data is drawn and what was done to it. In a `CaptionScope` the title is only the
 * accessible name, and the description is not printed.
 */
export function FigureFrame({
  title,
  description,
  report,
  actions,
  locale,
  source,
  coverage,
  transforms = [],
  status = 'ready',
  figure = {},
  series,
  titleDetail,
  footer,
  seriesLegend,
  scaleLegend,
  children,
}: FigureFrameProps): ReactNode {
  const isCaptioned = useIsCaptioned();
  const isPartial = coverage !== undefined && coverage.shown < coverage.total;
  const partial = isPartial ? coverageText(coverage, locale) : undefined;
  const notes = [isCaptioned ? partial : undefined, source, ...transforms].filter((note) => note !== undefined);
  const detail = isCaptioned ? titleDetail : undefined;
  const hasFooter = footer !== undefined || detail !== undefined || notes.length > 0;
  const heading = <ChartInspectionTitle title={title} detail={titleDetail} />;
  const reportMark = report === undefined ? {} : { 'data-figure-report': '' };

  const shownTitle =
    partial === undefined ? (
      heading
    ) : (
      <span {...stylex.props(styles.title)}>
        {heading}
        <Badge>{partial}</Badge>
      </span>
    );

  return (
    <ChartFrame
      figure={{ ...figure, ...reportMark, 'aria-busy': status === 'ready' ? undefined : true }}
      title={isCaptioned ? <span {...stylex.props(accessibility.hidden)}>{title}</span> : shownTitle}
      description={isCaptioned ? undefined : description}
      report={report}
      actions={actions}
      series={series}
      seriesLegend={seriesLegend}
      scaleLegend={scaleLegend}
      footer={
        hasFooter ? (
          <div {...stylex.props(styles.footnote)}>
            {detail !== undefined && (
              <p aria-hidden {...stylex.props(styles.compactDetail)}>
                {detail}
              </p>
            )}
            {footer}
            {notes.length > 0 && <p {...stylex.props(styles.note)}>{notes.join(' · ')}</p>}
          </div>
        ) : undefined
      }
    >
      {isCaptioned && description !== undefined && <p {...stylex.props(accessibility.hidden)}>{description}</p>}
      {children}
    </ChartFrame>
  );
}

/** The sentence a figure shows in place of its plot when there is nothing to draw. */
export function FigureEmpty({ children }: { readonly children: string }): ReactNode {
  return <p {...stylex.props(styles.empty)}>{children}</p>;
}

/** A figure whose input cannot be drawn faithfully. It states the reason and draws nothing. */
export function FigureInvalid({ message, ...frame }: FigureFrameInput & { readonly message: string }): ReactNode {
  return (
    <FigureFrame {...frame} status="ready">
      <Notice hasError>{message}</Notice>
    </FigureFrame>
  );
}

/**
 * A figure before its first read: the same frame and plot height as the loaded chart, so nothing moves when the data
 * arrives. The enclosing async region owns the announcement.
 */
export function FigureLoading({
  height = 'regular',
  ...frame
}: FigureFrameInput & { readonly height?: PlotHeight | undefined }): ReactNode {
  return (
    <div aria-hidden inert>
      <FigureFrame {...frame} status="loading">
        <Skeleton height={plotHeights[height]} />
      </FigureFrame>
    </div>
  );
}

import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { colors, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  grid: { display: 'flex', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: spacing.xl, minWidth: 0, margin: 0 },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: spacing.xl,
    minWidth: 0,
    margin: 0,
  },
  metric: {
    display: 'inline-flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  label: { minWidth: 0, color: colors.muted, order: 1, overflowWrap: 'anywhere' },
  value: {
    minWidth: 0,
    margin: 0,
    color: colors.ink,
    fontWeight: typography.mediumWeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  statistic: { flexDirection: 'column', alignItems: 'flex-start' },
  stackedLabel: { order: 0 },
  statisticValue: {
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
  },
  headline: { columnGap: spacing.sm },
  headlineLabel: { order: 0, flexBasis: '100%', fontSize: typography.captionSize },
  headlineValue: {
    fontSize: typography.headingSize,
    lineHeight: typography.headingLineHeight,
    fontWeight: typography.boldWeight,
    letterSpacing: typography.headingTracking,
  },
  detail: {
    minWidth: 0,
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    minHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  inlineDetail: { flexBasis: '100%' },
  valueRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
  change: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingBlock: spacing.xxs,
    paddingInline: spacing.sm,
    borderRadius: radii.sm,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
    letterSpacing: 'normal',
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: colors.canvas,
    color: colors.muted,
  },
  changePositive: { backgroundColor: colors.accentSoft, color: colors.accent },
  changeNegative: { backgroundColor: colors.dangerSoft, color: colors.danger },
  target: {
    margin: 0,
    minWidth: 0,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
  },
  trend: { margin: 0, minWidth: 0, width: '100%', alignSelf: 'stretch' },
});

export type MetricChange = { readonly value: string; readonly tone?: 'positive' | 'negative' | 'neutral' };

type MetricLayout = 'inline' | 'columns';

const variants = {
  inline: { metric: undefined, label: undefined, value: undefined, detail: styles.inlineDetail, valueWidth: '5ch' },
  statistic: {
    metric: styles.statistic,
    label: styles.stackedLabel,
    value: styles.statisticValue,
    detail: undefined,
    valueWidth: '5ch',
  },
  headline: {
    metric: styles.headline,
    label: styles.headlineLabel,
    value: styles.headlineValue,
    detail: undefined,
    valueWidth: '9ch',
  },
};

type MetricVariant = keyof typeof variants;

const layouts = { inline: styles.grid, columns: styles.columns } satisfies Record<MetricLayout, stylex.StyleXStyles>;

export type MetricGridProps = ComponentProps<'dl'> & { readonly layout?: MetricLayout };

export type MetricProps = Omit<ComponentProps<'div'>, 'children' | 'dangerouslySetInnerHTML'> & {
  readonly label: string;
  readonly variant?: MetricVariant;
  readonly trend?: ReactElement;
  /** Optional signed delta badge drawn beside the value (such as `+20.9% vs starter`). */
  readonly change?: MetricChange | undefined;
  /** Optional target or ceiling reference shown quietly below the detail line. */
  readonly target?: string | undefined;
  readonly isLoading?: boolean | undefined;
  readonly value?: string | undefined;
  readonly detail?: string | undefined;
  readonly hasDetail?: boolean | undefined;
};

export function MetricGrid({ layout = 'inline', ...props }: MetricGridProps): ReactNode {
  return <dl {...mergeProps(stylex.props(layouts[layout]), props)} />;
}

export function Metric({
  label,
  value,
  detail,
  change,
  target,
  isLoading = false,
  hasDetail = false,
  variant = 'inline',
  trend,
  ...props
}: MetricProps): ReactNode {
  const appearance = variants[variant];
  const shouldShowDetail = isLoading ? hasDetail || detail !== undefined : detail !== undefined;

  const changeTone =
    change?.tone === 'positive'
      ? styles.changePositive
      : change?.tone === 'negative'
        ? styles.changeNegative
        : undefined;

  return (
    <div {...mergeProps(stylex.props(styles.metric, appearance.metric), props)}>
      <dt {...stylex.props(styles.label, appearance.label)}>{label}</dt>
      <dd {...stylex.props(styles.value, appearance.value)}>
        <span {...stylex.props(styles.valueRow)}>
          <span>{isLoading ? <SkeletonText width={appearance.valueWidth} /> : (value ?? '—')}</span>
          {!isLoading && change !== undefined && (
            <span {...stylex.props(styles.change, changeTone)}>{change.value}</span>
          )}
        </span>
      </dd>
      {shouldShowDetail && (
        <dd {...stylex.props(styles.detail, appearance.detail)}>
          {isLoading ? <SkeletonText width="24ch" /> : detail}
        </dd>
      )}
      {!isLoading && target !== undefined && <dd {...stylex.props(styles.target)}>{target}</dd>}
      {trend !== undefined && <dd {...stylex.props(styles.trend)}>{trend}</dd>}
    </div>
  );
}

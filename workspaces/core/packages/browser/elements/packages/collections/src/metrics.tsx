import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

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
  trend: { margin: 0, minWidth: 0, width: '100%', alignSelf: 'stretch' },
});

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
} & (
    | { readonly isLoading?: false; readonly value: string; readonly detail?: string; readonly hasDetail?: never }
    | { readonly isLoading: true; readonly value?: never; readonly detail?: never; readonly hasDetail?: boolean }
  );

export function MetricGrid({ layout = 'inline', ...props }: MetricGridProps): ReactNode {
  return <dl {...mergeProps(stylex.props(layouts[layout]), props)} />;
}

export function Metric({
  label,
  value,
  detail,
  isLoading = false,
  hasDetail = false,
  variant = 'inline',
  trend,
  ...props
}: MetricProps): ReactNode {
  const appearance = variants[variant];

  return (
    <div {...mergeProps(stylex.props(styles.metric, appearance.metric), props)}>
      <dt {...stylex.props(styles.label, appearance.label)}>{label}</dt>
      <dd {...stylex.props(styles.value, appearance.value)}>
        {isLoading ? <SkeletonText width={appearance.valueWidth} /> : value}
      </dd>
      {(isLoading ? hasDetail : detail !== undefined) && (
        <dd {...stylex.props(styles.detail, appearance.detail)}>
          {isLoading ? <SkeletonText width="24ch" /> : detail}
        </dd>
      )}
      {trend !== undefined && <dd {...stylex.props(styles.trend)}>{trend}</dd>}
    </div>
  );
}

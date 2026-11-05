import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
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
});

type MetricLayout = 'inline' | 'columns';
const layouts = { inline: styles.grid, columns: styles.columns } satisfies Record<MetricLayout, stylex.StyleXStyles>;

type MetricGridProps = ComponentProps<'dl'> & { readonly layout?: MetricLayout };
type MetricProps = ComponentProps<'div'> & { readonly label: string; readonly value: string };

export function MetricGrid({ layout = 'inline', ...props }: MetricGridProps): ReactNode {
  return <dl {...mergeProps(stylex.props(layouts[layout]), props)} />;
}

export function Metric({ label, value, ...props }: MetricProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.metric), props)}>
      <dt {...stylex.props(styles.label)}>{label}</dt>
      <dd {...stylex.props(styles.value)}>{value}</dd>
    </div>
  );
}

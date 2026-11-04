import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  grid: { display: 'flex', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: spacing.xl, margin: 0 },
  metric: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 5,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  label: { color: colors.muted, order: 1 },
  value: { margin: 0, color: colors.ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
});

type MetricGridProps = ComponentProps<'dl'>;
type MetricProps = ComponentProps<'div'> & { readonly label: string; readonly value: string };

export function MetricGrid(props: MetricGridProps): ReactNode {
  return <dl {...mergeProps(stylex.props(styles.grid), props)} />;
}

export function Metric({ label, value, ...props }: MetricProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.metric), props)}>
      <dt {...stylex.props(styles.label)}>{label}</dt>
      <dd {...stylex.props(styles.value)}>{value}</dd>
    </div>
  );
}

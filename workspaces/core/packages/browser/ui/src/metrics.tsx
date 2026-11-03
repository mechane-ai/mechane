import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  grid: { display: 'flex', flexWrap: 'wrap', gap: '8px 24px', margin: 0 },
  metric: { display: 'inline-flex', alignItems: 'baseline', gap: 5, minWidth: 0, fontSize: 13, lineHeight: '20px' },
  label: { color: colors.muted, order: 1 },
  value: { margin: 0, color: colors.ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
});

export function MetricGrid({ children }: { readonly children: ReactNode }): ReactNode {
  return <dl {...stylex.props(styles.grid)}>{children}</dl>;
}

export function Metric({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div {...stylex.props(styles.metric)}>
      <dt {...stylex.props(styles.label)}>{label}</dt>
      <dd {...stylex.props(styles.value)}>{value}</dd>
    </div>
  );
}

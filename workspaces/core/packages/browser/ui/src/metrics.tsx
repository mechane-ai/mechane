import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: { 'default': 'repeat(3,minmax(0,1fr))', '@media (max-width:600px)': '1fr' },
    columnGap: 32,
    rowGap: 24,
  },
  metric: { minWidth: 0 },
  label: { fontSize: 13, lineHeight: '20px', color: colors.muted, marginBottom: 6 },
  value: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: '40px',
    fontWeight: 400,
    letterSpacing: '-0.8px',
    fontVariantNumeric: 'tabular-nums',
    marginBottom: 4,
    overflowWrap: 'anywhere',
  },
});

export function MetricGrid({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.grid)}>{children}</div>;
}

export function Metric({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.metric)}>
      <div {...stylex.props(styles.label)}>{label}</div>
      <div {...stylex.props(styles.value)}>{value}</div>
      {detail}
    </div>
  );
}

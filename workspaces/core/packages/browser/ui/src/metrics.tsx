import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: { 'default': 'repeat(3,minmax(0,1fr))', '@media (max-width:600px)': '1fr' },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: 5,
    overflow: 'hidden',
  },
  metric: {
    'padding': '16px 18px',
    'backgroundColor': colors.surface,
    'borderInlineEndWidth': 1,
    'borderInlineEndStyle': 'solid',
    'borderInlineEndColor': colors.line,
    ':last-child': { borderInlineEndWidth: 0 },
    '@media (max-width:600px)': {
      borderInlineEndWidth: 0,
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: colors.line,
    },
  },
  label: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  value: {
    fontSize: 22,
    fontWeight: 500,
    letterSpacing: '-0.4px',
    fontVariantNumeric: 'tabular-nums',
    marginBottom: 3,
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

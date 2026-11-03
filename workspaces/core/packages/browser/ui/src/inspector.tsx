import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  split: {
    display: 'grid',
    gridTemplateColumns: {
      'default': 'minmax(0, 1.3fr) minmax(280px, 1fr)',
      '@media (max-width: 1050px)': 'minmax(0, 1fr)',
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: 5,
    overflow: 'hidden',
  },
  master: { minWidth: 0 },
  detail: {
    'minWidth': 0,
    'padding': 20,
    'backgroundColor': colors.canvas,
    'borderLeftWidth': 1,
    'borderLeftStyle': 'solid',
    'borderLeftColor': colors.line,
    '@media (max-width: 1050px)': {
      borderLeftWidth: 0,
      borderTopWidth: 1,
      borderTopStyle: 'solid',
      borderTopColor: colors.line,
    },
  },
  list: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, 1.6fr)',
    gap: '8px 16px',
    fontSize: 12,
    lineHeight: 1.5,
  },
  label: { color: colors.muted },
  item: { display: 'contents' },
  value: { margin: 0, color: colors.ink, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
});

export function Inspector({ master, detail }: { readonly master: ReactNode; readonly detail: ReactNode }): ReactNode {
  return (
    <div {...stylex.props(styles.split)}>
      <div {...stylex.props(styles.master)}>{master}</div>
      <aside aria-label="Selected request" {...stylex.props(styles.detail)}>
        {detail}
      </aside>
    </div>
  );
}

export function Details({
  items,
}: {
  readonly items: ReadonlyArray<{ readonly label: string; readonly value: ReactNode }>;
}): ReactNode {
  return (
    <dl {...stylex.props(styles.list)}>
      {items.map(({ label, value }) => (
        <div key={label} {...stylex.props(styles.item)}>
          <dt {...stylex.props(styles.label)}>{label}</dt>
          <dd {...stylex.props(styles.value)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

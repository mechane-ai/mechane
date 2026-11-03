import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  master: { minWidth: 0 },
  detail: {
    minWidth: 0,
    padding: 24,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  list: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, 1.6fr)',
    columnGap: 24,
    rowGap: 12,
    fontSize: 13,
    lineHeight: '20px',
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

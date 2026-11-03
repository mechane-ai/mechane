import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    padding: '12px 16px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    color: colors.muted,
    fontSize: 13,
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
});

export function ListFooter({
  children,
  actions,
}: {
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.footer)}>
      <div>{children}</div>
      {actions !== undefined && actions !== null && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </div>
  );
}

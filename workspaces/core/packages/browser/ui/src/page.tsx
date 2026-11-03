import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
  detail: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 1080,
    minWidth: 0,
    marginInline: 'auto',
    padding: { 'default': 48, '@media (max-width: 1000px)': 24, '@media (max-width: 600px)': 16 },
  },
});

export function DetailPage({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.detail)}>{children}</div>;
}

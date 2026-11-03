import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
  detail: {
    boxSizing: 'border-box',
    width: { 'default': '84%', '@media (max-width:720px)': '100%' },
    maxWidth: 980,
    minWidth: 0,
    marginInline: 'auto',
    paddingInline: { 'default': 0, '@media (max-width:720px)': 24 },
    paddingTop: { 'default': 44, '@media (max-width:720px)': 32 },
    paddingBottom: { 'default': 64, '@media (max-width:720px)': 52 },
  },
});

export function DetailPage({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.detail)}>{children}</div>;
}

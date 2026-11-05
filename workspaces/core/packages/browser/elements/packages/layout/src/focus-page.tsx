import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  page: {
    boxSizing: 'border-box',
    minHeight: '100dvh',
    minWidth: 0,
    display: 'grid',
    placeItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    WebkitFontSmoothing: 'antialiased',
  },
  content: {
    width: '100%',
    maxWidth: '360px',
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: spacing.xl,
  },
});

export function FocusPage({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <main id="main" tabIndex={-1} {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.content)}>{children}</div>
    </main>
  );
}

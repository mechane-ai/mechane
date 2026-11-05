import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    minWidth: 0,
    gap: spacing.md,
    paddingBlock: spacing.md,
    paddingInline: spacing.lg,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  content: { minWidth: 0, overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
});

type ListFooterProps = ComponentProps<'div'> & { readonly actions?: ReactNode };

export function ListFooter({ children, actions, ...props }: ListFooterProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.footer), props)}>
      <div {...stylex.props(styles.content)}>{children}</div>
      {actions !== undefined && actions !== null && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </div>
  );
}

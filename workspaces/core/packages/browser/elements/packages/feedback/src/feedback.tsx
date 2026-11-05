import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import { Box } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Muted, Subheading } from '../../core/src/index.ts';
import { colors, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingBlock: spacing.xxl,
    paddingInline: spacing.xl,
    gap: spacing.md,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
    overflowWrap: 'anywhere',
  },
  emptyIcon: { color: colors.muted, flexShrink: 0 },
  emptyAction: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minWidth: 0,
    maxWidth: '100%',
  },
  notice: {
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingBlock: spacing.md,
    paddingInline: spacing.md,
    borderRadius: radii.sm,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    overflowWrap: 'anywhere',
  },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
});

type EmptyStateProps = Omit<ComponentProps<'div'>, 'title'> & { readonly title: string; readonly action?: ReactNode };

type NoticeProps = ComponentProps<'div'> & { readonly error?: boolean };

export function EmptyState({ title, children, action, ...props }: EmptyStateProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.empty), props)}>
      <Box size={22} aria-hidden {...stylex.props(styles.emptyIcon)} />
      <Subheading>{title}</Subheading>
      {children !== undefined && children !== null && <Muted>{children}</Muted>}
      {action !== undefined && action !== null && <div {...stylex.props(styles.emptyAction)}>{action}</div>}
    </div>
  );
}

export function Notice({ error = false, ...props }: NoticeProps): ReactNode {
  return (
    <div
      {...mergeProps(
        { role: error ? 'alert' : 'status' },
        stylex.props(styles.notice, error && styles.negative),
        props,
      )}
    />
  );
}

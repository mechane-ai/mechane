import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import { Box } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Muted, Subheading } from './text.tsx';
import { colors, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  panel: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
  },
  padded: { padding: spacing.xl },
  row: { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0 },
  between: { justifyContent: 'space-between' },
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.xl, minWidth: 0 },
  compact: { gap: spacing.sm },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
    gap: spacing.xxl,
    minWidth: 0,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    paddingBlock: 64,
    paddingInline: spacing.xl,
    gap: spacing.md,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
  },
  emptyIcon: { color: colors.muted, marginBottom: spacing.xs },
  notice: {
    paddingBlock: 10,
    paddingInline: spacing.md,
    borderRadius: radii.sm,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    overflowWrap: 'anywhere',
  },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  divider: { borderWidth: 0, borderTopWidth: 1, borderStyle: 'solid', borderColor: colors.line, margin: 0 },
});

type PanelProps = ComponentProps<'section'> & { readonly padded?: boolean };
type RowProps = ComponentProps<'div'> & { readonly between?: boolean };
type StackProps = ComponentProps<'div'> & { readonly compact?: boolean };
type ColumnsProps = ComponentProps<'div'>;
type DividerProps = ComponentProps<'hr'>;
type EmptyStateProps = Omit<ComponentProps<'div'>, 'title'> & { readonly title: string; readonly action?: ReactNode };
type NoticeProps = ComponentProps<'div'> & { readonly error?: boolean };

export function Panel({ padded = true, ...props }: PanelProps): ReactNode {
  return <section {...mergeProps(stylex.props(styles.panel, padded && styles.padded), props)} />;
}

export function Row({ between = false, ...props }: RowProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.row, between && styles.between), props)} />;
}

export function Stack({ compact = false, ...props }: StackProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.stack, compact && styles.compact), props)} />;
}

export function Columns(props: ColumnsProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.columns), props)} />;
}

export function Divider(props: DividerProps): ReactNode {
  return <hr {...mergeProps(stylex.props(styles.divider), props)} />;
}

export function EmptyState({ title, children, action, ...props }: EmptyStateProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.empty), props)}>
      <Box size={22} aria-hidden {...stylex.props(styles.emptyIcon)} />
      <Subheading>{title}</Subheading>
      <Muted>{children}</Muted>
      {action}
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

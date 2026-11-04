import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

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
  divider: { borderWidth: 0, borderTopWidth: 1, borderStyle: 'solid', borderColor: colors.line, margin: 0 },
});

type PanelProps = ComponentProps<'section'> & { readonly padded?: boolean };

type RowProps = ComponentProps<'div'> & { readonly between?: boolean };

type StackProps = ComponentProps<'div'> & { readonly compact?: boolean };

type ColumnsProps = ComponentProps<'div'>;

type DividerProps = ComponentProps<'hr'>;

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

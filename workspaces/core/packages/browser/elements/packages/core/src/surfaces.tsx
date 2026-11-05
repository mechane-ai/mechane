import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  panel: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
    WebkitFontSmoothing: 'antialiased',
  },
  padded: { padding: spacing.xl },
  link: {
    'display': 'block',
    'boxSizing': 'border-box',
    'minWidth': 0,
    'minHeight': { default: 0, [conditions.coarsePointer]: controls.coarseTarget },
    'borderRadius': 'inherit',
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'WebkitFontSmoothing': 'antialiased',
    'textDecorationLine': 'none',
    'overflowWrap': 'anywhere',
    ':hover:not(:active)': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: `calc(0px - ${controls.focusWidth})`,
    },
  },
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

type PanelProps = ComponentProps<'section'> & { readonly isPadded?: boolean };

type SurfaceLinkProps = ComponentProps<'a'> & { readonly xstyle?: PlacementStyle };

type RowProps = ComponentProps<'div'> & { readonly shouldSpaceBetween?: boolean };

type StackProps = ComponentProps<'div'> & { readonly isCompact?: boolean };

type ColumnsProps = ComponentProps<'div'>;

type DividerProps = ComponentProps<'hr'>;

export function Panel({ isPadded = true, ...props }: PanelProps): ReactNode {
  return <section {...mergeProps(stylex.props(styles.panel, isPadded && styles.padded), props)} />;
}

export function SurfaceLink({ xstyle, ...props }: SurfaceLinkProps): ReactNode {
  return <a {...mergeProps(stylex.props(styles.link, xstyle), props)} />;
}

export function Row({ shouldSpaceBetween = false, ...props }: RowProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.row, shouldSpaceBetween && styles.between), props)} />;
}

export function Stack({ isCompact = false, ...props }: StackProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.stack, isCompact && styles.compact), props)} />;
}

export function Columns(props: ColumnsProps): ReactNode {
  return <div {...mergeProps(stylex.props(styles.columns), props)} />;
}

export function Divider(props: DividerProps): ReactNode {
  return <hr {...mergeProps(stylex.props(styles.divider), props)} />;
}

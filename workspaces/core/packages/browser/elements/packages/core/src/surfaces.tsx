import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { RouteLink } from './route-link.tsx';

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
  framedHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 34,
    paddingInline: spacing.lg,
    paddingBlock: spacing.xs,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.canvas,
  },
  framedTitleGroup: { display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  framedIndex: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    paddingInline: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
    color: colors.inverse,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.mediumWeight,
    lineHeight: 1,
    flexShrink: 0,
  },
  framedTitle: {
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
    color: colors.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  framedMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    flexShrink: 0,
  },
  framedBody: { minWidth: 0 },
  framedBodyPadded: { padding: spacing.xl },
  framedFooter: {
    paddingInline: spacing.lg,
    paddingBlock: spacing.sm,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    backgroundColor: colors.canvas,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
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

export type PanelProps = Omit<ComponentProps<'section'>, 'title'> & {
  readonly isPadded?: boolean;
  /** Integrated technical-sheet title bar; when set, `Panel` renders a framed header strip. */
  readonly title?: string | undefined;
  /** Optional short index label (such as `"A"`, `"B"`, `"01"`) shown beside `title`. */
  readonly index?: string | undefined;
  /** Right-aligned scope, unit, or compact actions inside the header strip. */
  readonly meta?: ReactNode;
  /** Provenance or footnote bar anchored at the bottom of the panel. */
  readonly footer?: ReactNode;
  /** Removes inner body padding so tables or full-bleed visuals share the panel's outer border. */
  readonly isFlush?: boolean;
};

type SurfaceLinkProps = ComponentProps<'a'> & { readonly xstyle?: PlacementStyle };

type RowProps = ComponentProps<'div'> & { readonly shouldSpaceBetween?: boolean };

type StackProps = ComponentProps<'div'> & { readonly isCompact?: boolean };

type ColumnsProps = ComponentProps<'div'>;

type DividerProps = ComponentProps<'hr'>;

function PanelHeader({
  title,
  index,
  meta,
}: {
  readonly title: string | undefined;
  readonly index: string | undefined;
  readonly meta: ReactNode;
}): ReactNode {
  return (
    <header {...stylex.props(styles.framedHeader)}>
      <div {...stylex.props(styles.framedTitleGroup)}>
        {index !== undefined && <span {...stylex.props(styles.framedIndex)}>{index}</span>}
        {title !== undefined && <span {...stylex.props(styles.framedTitle)}>{title}</span>}
      </div>
      {meta !== undefined && <div {...stylex.props(styles.framedMeta)}>{meta}</div>}
    </header>
  );
}

export function Panel({
  isPadded = true,
  title,
  index,
  meta,
  footer,
  isFlush = false,
  children,
  ...props
}: PanelProps): ReactNode {
  const hasHeader = title !== undefined || index !== undefined || meta !== undefined;
  const hasFrameChrome = hasHeader || footer !== undefined;
  const isBodyPadded = isPadded && !isFlush;

  if (!hasFrameChrome) {
    return (
      <section {...mergeProps(stylex.props(styles.panel, isBodyPadded && styles.padded), props)}>{children}</section>
    );
  }

  return (
    <section {...mergeProps(stylex.props(styles.panel), props)}>
      {hasHeader && <PanelHeader title={title} index={index} meta={meta} />}
      <div {...stylex.props(styles.framedBody, isBodyPadded && styles.framedBodyPadded)}>{children}</div>
      {footer !== undefined && <footer {...stylex.props(styles.framedFooter)}>{footer}</footer>}
    </section>
  );
}

export function SurfaceLink({ xstyle, ...props }: SurfaceLinkProps): ReactNode {
  return <RouteLink {...mergeProps(stylex.props(styles.link, xstyle), props)} />;
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

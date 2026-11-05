import * as stylex from '@stylexjs/stylex';
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import type { ToasterProps as SonnerToasterProps } from 'sonner';
import {
  colors,
  conditions,
  controls,
  layers,
  motion,
  radii,
  shadows,
  spacing,
  typography,
} from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  toast: {
    'width': 'var(--width)',
    'display': 'flex',
    'flexWrap': 'wrap',
    'alignItems': 'center',
    'gap': spacing.sm,
    'padding': spacing.lg,
    ':has([data-close-button])': {
      paddingInlineEnd: {
        default: `calc(${spacing.md} + ${controls.height})`,
        [conditions.coarsePointer]: `calc(${spacing.md} + ${controls.coarseTarget})`,
      },
    },
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.md,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'boxShadow': `${shadows.popup} !important`,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'fontWeight': typography.regularWeight,
  },
  // Sonner's unlayered CSS requires important motion declarations.
  // Keep the default in the fallback: StyleX emits custom property defaults outside layers.
  motion: {
    '--elements-toast-duration': { [conditions.reducedMotion]: '0s' },
    'transitionDuration': `var(--elements-toast-duration, ${motion.duration}) !important`,
    'transitionTimingFunction': `${motion.easing} !important`,
    'animationDuration': `var(--elements-toast-duration, ${motion.duration}) !important`,
    ':is([data-swiping="true"])': { '--elements-toast-duration': '0s' },
  },
  focus: {
    ':focus-visible': {
      outlineWidth: `${controls.focusWidth} !important`,
      outlineStyle: 'solid !important',
      outlineColor: `${colors.focus} !important`,
      outlineOffset: 2,
    },
  },
  part: {
    opacity: {
      default: 1,
      [stylex.when.ancestor('[data-sonner-toast][data-expanded="false"][data-front="false"]')]: 0,
    },
    transitionProperty: 'opacity',
    transitionDuration: `var(--elements-toast-duration, ${motion.duration}) !important`,
    transitionTimingFunction: `${motion.easing} !important`,
  },
  content: { display: 'flex', flexDirection: 'column', flex: '1 1 12ch', minWidth: 0, gap: spacing.xxs },
  title: { fontWeight: typography.mediumWeight },
  description: { color: colors.muted },
  icon: { display: 'flex', position: 'relative', flexShrink: 0, width: controls.iconSize, height: controls.iconSize },
  glyph: {
    width: controls.iconSize,
    height: controls.iconSize,
    animationDuration: { [conditions.reducedMotion]: '0s !important' },
  },
  success: { color: colors.accent },
  error: { color: colors.danger },
  warning: { color: colors.warning },
  neutral: { color: colors.muted },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    minWidth: 0,
    maxWidth: '100%',
    minHeight: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    paddingBlock: spacing.xs,
    paddingInline: controls.paddingInline,
    borderWidth: 0,
    borderRadius: radii.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    cursor: 'pointer',
  },
  action: {
    'backgroundColor': colors.ink,
    'color': colors.inverse,
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
    ':active': { backgroundColor: colors.inkHover },
  },
  cancel: {
    'backgroundColor': colors.canvas,
    'color': colors.ink,
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.line } },
    ':active': { backgroundColor: colors.line },
  },
  close: {
    'position': 'absolute',
    'insetBlockStart': spacing.xs,
    'insetInlineEnd': spacing.xs,
    'minWidth': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInline': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    ':hover:not(:active):not([data-disabled="true"])': {
      backgroundColor: { [conditions.hoverPointer]: colors.canvas },
    },
    ':active:not([data-disabled="true"])': { backgroundColor: colors.line },
    ':is([data-disabled="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
  },
});

export type ToasterProps = Pick<
  SonnerToasterProps,
  | 'id'
  | 'position'
  | 'hotkey'
  | 'expand'
  | 'duration'
  | 'visibleToasts'
  | 'closeButton'
  | 'offset'
  | 'mobileOffset'
  | 'dir'
  | 'swipeDirections'
  | 'containerAriaLabel'
> & { readonly closeButtonAriaLabel?: string };

export function Toaster({
  closeButton = true,
  closeButtonAriaLabel = 'Dismiss notification',
  offset = spacing.xl,
  mobileOffset = spacing.lg,
  ...props
}: ToasterProps): ReactNode {
  return (
    <SonnerToaster
      {...props}
      {...stylex.props(styles.motion, styles.focus)}
      style={{ zIndex: layers.popup, transitionProperty: 'opacity, transform' }}
      offset={offset}
      mobileOffset={mobileOffset}
      closeButton={closeButton}
      icons={{
        success: <CircleCheck aria-hidden {...stylex.props(styles.glyph, styles.success)} />,
        error: <CircleX aria-hidden {...stylex.props(styles.glyph, styles.error)} />,
        warning: <TriangleAlert aria-hidden {...stylex.props(styles.glyph, styles.warning)} />,
        info: <Info aria-hidden {...stylex.props(styles.glyph, styles.neutral)} />,
        loading: <LoaderCircle aria-hidden {...stylex.props(styles.glyph, styles.neutral)} />,
        close: <X aria-hidden {...stylex.props(styles.glyph)} />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel,
        style: { transitionProperty: 'opacity, transform' },
        classNames: {
          toast: stylex.props(styles.toast, styles.motion, styles.focus, stylex.defaultMarker()).className ?? '',
          title: stylex.props(styles.title).className ?? '',
          description: stylex.props(styles.description).className ?? '',
          content: stylex.props(styles.content, styles.part).className ?? '',
          icon: stylex.props(styles.icon, styles.part).className ?? '',
          loader: stylex.props(styles.motion).className ?? '',
          actionButton: stylex.props(styles.button, styles.action, styles.focus, styles.part).className ?? '',
          cancelButton: stylex.props(styles.button, styles.cancel, styles.focus, styles.part).className ?? '',
          closeButton: stylex.props(styles.button, styles.close, styles.focus, styles.part).className ?? '',
        },
      }}
    />
  );
}

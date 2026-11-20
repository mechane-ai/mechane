import * as stylex from '@stylexjs/stylex';
import {
  ToastAction as SdkToastAction,
  Toast,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from '@ui-sdk/react/toast';
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { conditions, layers } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, motion, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { notificationQueues } from './notifications.ts';

const styles = stylex.create({
  region: {
    'width': {
      default: `min(356px, calc(100% - 2 * ${spacing.xl}))`,
      [conditions.compactText]: `min(356px, calc(100% - 2 * ${spacing.lg}))`,
    },
    'marginBlock': { default: spacing.xl, [conditions.compactText]: spacing.lg },
    ':not([data-align="center"])': { marginInline: { default: spacing.xl, [conditions.compactText]: spacing.lg } },
    'height': 'var(--toast-front-height, 0px)',
    'zIndex': layers.popup,
    ':is([data-expanded])': { height: 'calc(var(--toast-stack-height) + (var(--toast-count) - 1) * 8px)' },
  },
  toast: {
    'position': 'absolute',
    'boxSizing': 'border-box',
    'insetInline': 0,
    'overflow': 'hidden',
    'zIndex': 'calc(100 - var(--toast-index))',
    'height': 'var(--toast-height)',

    'transitionProperty': 'opacity, transform',
    'transitionTimingFunction': motion.easing,
    'transitionDuration': { default: motion.duration, [conditions.reducedMotion]: '0s' },
    ':not([data-expanded], [data-front])': { height: 'var(--toast-front-height)' },
    ':is([data-swiping])': { transitionDuration: '0s' },
    ':is([data-starting-style], [data-ending-style])': { opacity: 0 },
    'display': 'flex',
    'flexWrap': 'wrap',
    'alignItems': 'center',
    'gap': spacing.sm,
    'padding': spacing.md,
    ':has([data-slot="toast-close"])': {
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
    'boxShadow': shadows.popup,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'fontWeight': typography.regularWeight,
  },
  top: {
    'top': 0,
    'transform':
      'translate(var(--toast-swipe-x, 0px), calc(var(--toast-index) * 8px + var(--toast-swipe-y, 0px))) scale(calc(1 - var(--toast-index) * 0.05))',
    ':is([data-expanded])': {
      transform:
        'translate(var(--toast-swipe-x, 0px), calc(var(--toast-offset) + var(--toast-index) * 8px + var(--toast-swipe-y, 0px)))',
    },
  },
  bottom: {
    'bottom': 0,
    'transform':
      'translate(var(--toast-swipe-x, 0px), calc(var(--toast-index) * -8px + var(--toast-swipe-y, 0px))) scale(calc(1 - var(--toast-index) * 0.05))',
    ':is([data-expanded])': {
      transform:
        'translate(var(--toast-swipe-x, 0px), calc(-1 * var(--toast-offset) - var(--toast-index) * 8px + var(--toast-swipe-y, 0px)))',
    },
  },
  focus: {
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  part: {
    opacity: { default: 1, [stylex.when.ancestor(':is([data-slot="toast"]:not([data-expanded], [data-front]))')]: 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.duration,
    transitionTimingFunction: motion.easing,
  },
  content: { display: 'flex', flexDirection: 'column', flex: '1 1 24ch', minWidth: 0, gap: spacing.xxs },
  title: {
    fontWeight: typography.mediumWeight,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  description: {
    color: colors.muted,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  icon: { display: 'flex', position: 'relative', flexShrink: 0, width: controls.iconSize, height: controls.iconSize },
  glyph: {
    width: controls.iconSize,
    height: controls.iconSize,
    animationDuration: { [conditions.reducedMotion]: '0s' },
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
  close: {
    'position': 'absolute',
    'insetBlockStart': spacing.xs,
    'insetInlineEnd': spacing.xs,
    'minWidth': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInline': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    ':hover:not(:active):not([aria-disabled="true"])': {
      backgroundColor: { [conditions.hoverPointer]: colors.canvas },
    },
    ':active:not([aria-disabled="true"])': { backgroundColor: colors.line },
    ':is([aria-disabled="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
  },
});

const statusIcons = {
  default: { Icon: Info, tone: styles.neutral },
  info: { Icon: Info, tone: styles.neutral },
  success: { Icon: CircleCheck, tone: styles.success },
  warning: { Icon: TriangleAlert, tone: styles.warning },
  error: { Icon: CircleX, tone: styles.error },
  loading: { Icon: LoaderCircle, tone: styles.neutral },
};

export type ToasterProps = {
  readonly id?: string;
  readonly side?: 'top' | 'bottom';
  readonly align?: 'start' | 'center' | 'end';
  readonly isExpanded?: boolean;
  readonly visibleToasts?: number;
  readonly showCloseButton?: boolean;
  readonly closeButtonAriaLabel?: string;
  readonly containerAriaLabel?: string;
};

export function Toaster({
  id,
  side = 'bottom',
  align = 'end',
  isExpanded = false,
  visibleToasts = 3,
  showCloseButton = true,
  closeButtonAriaLabel = 'Dismiss notification',
  containerAriaLabel = 'Notifications',
}: ToasterProps): ReactNode {
  const queue = notificationQueues.queueFor(id);

  useEffect(() => notificationQueues.bind(id, queue), [id, queue]);

  return (
    <ToastRegion
      toaster={queue}
      side={side}
      align={align}
      expanded={isExpanded}
      maxVisible={visibleToasts}
      shortcut="alt+t"
      aria-label={containerAriaLabel}
      {...stylex.props(styles.region)}
    >
      {(item) => {
        const { Icon, tone } = statusIcons[item.type];

        return (
          <Toast {...stylex.props(styles.toast, styles[side], styles.focus, stylex.defaultMarker())}>
            <Icon aria-hidden {...stylex.props(styles.icon, styles.part, tone)} />
            <div {...stylex.props(styles.content, styles.part)}>
              <ToastTitle {...stylex.props(styles.title)} />
              <ToastDescription {...stylex.props(styles.description)} />
            </div>
            {item.action?.label !== undefined && (
              <SdkToastAction {...stylex.props(styles.button, styles.action, styles.focus, styles.part)} />
            )}
            {showCloseButton && (
              <ToastClose
                aria-label={closeButtonAriaLabel}
                {...stylex.props(styles.button, styles.close, styles.focus, styles.part)}
              >
                <X aria-hidden {...stylex.props(styles.glyph)} />
              </ToastClose>
            )}
          </Toast>
        );
      }}
    </ToastRegion>
  );
}

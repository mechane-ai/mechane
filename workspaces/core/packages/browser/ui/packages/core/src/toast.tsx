import { Toast as BaseToast } from '@base-ui/react/toast';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { overlayStyles } from './overlay-styles.ts';
import { popupStyles } from './popup-styles.ts';
import { mergeStyles } from './style-composition.ts';
import { colors, controls, layers, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  viewport: {
    position: 'fixed',
    bottom: spacing.xl,
    right: spacing.xl,
    zIndex: layers.popup,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    width: 'min(360px, calc(100vw - 48px))',
    maxHeight: 'calc(100dvh - 48px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    outlineWidth: 0,
  },
  focus: {
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  root: {
    'width': '100%',
    'padding': spacing.lg,
    'transform': 'translate(var(--toast-swipe-movement-x, 0px), var(--toast-swipe-movement-y, 0px))',
    ':is([data-limited])': { display: 'none' },
  },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  title: { fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight, fontWeight: 500 },
});

type ToastViewportProps = ComponentProps<typeof BaseToast.Viewport>;
type ToastRootProps = ComponentProps<typeof BaseToast.Root>;
type ToastContentProps = ComponentProps<typeof BaseToast.Content>;
type ToastTitleProps = ComponentProps<typeof BaseToast.Title>;
type ToastDescriptionProps = ComponentProps<typeof BaseToast.Description>;
type ToastCloseProps = ComponentProps<typeof BaseToast.Close>;

function ToastViewport({ className, style, ...props }: ToastViewportProps): ReactNode {
  return (
    <BaseToast.Viewport
      {...props}
      {...mergeStyles<BaseToast.Viewport.State>({
        className,
        style,
        styles: stylex.props(styles.viewport, styles.focus),
      })}
    />
  );
}

function ToastRoot({ className, style, ...props }: ToastRootProps): ReactNode {
  return (
    <BaseToast.Root
      {...props}
      {...mergeStyles<BaseToast.Root.State>({
        className,
        style,
        styles: stylex.props(popupStyles.surface, styles.root, styles.focus),
      })}
    />
  );
}

function ToastContent({ className, style, ...props }: ToastContentProps): ReactNode {
  return (
    <BaseToast.Content
      {...props}
      {...mergeStyles<BaseToast.Content.State>({ className, style, styles: stylex.props(styles.content) })}
    />
  );
}

function ToastTitle({ className, style, ...props }: ToastTitleProps): ReactNode {
  return (
    <BaseToast.Title
      {...props}
      {...mergeStyles<BaseToast.Title.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.title, styles.title),
      })}
    />
  );
}

function ToastDescription({ className, style, ...props }: ToastDescriptionProps): ReactNode {
  return (
    <BaseToast.Description
      {...props}
      {...mergeStyles<BaseToast.Description.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.description),
      })}
    />
  );
}

function ToastClose(props: ToastCloseProps): ReactNode {
  // The flat viewport keeps dismissal visible even when Base UI's stacked viewport would be collapsed.
  return <BaseToast.Close aria-hidden={false} {...props} />;
}

export const Toast = {
  Provider: BaseToast.Provider,
  Portal: BaseToast.Portal,
  Viewport: ToastViewport,
  Root: ToastRoot,
  Content: ToastContent,
  Title: ToastTitle,
  Description: ToastDescription,
  Close: ToastClose,
  Action: BaseToast.Action,
  useManager: BaseToast.useToastManager,
  createManager: BaseToast.createToastManager,
};

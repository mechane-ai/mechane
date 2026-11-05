import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { conditions, layers } from '../../foundations/src/constants.stylex.ts';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, motion, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  viewport: { position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: layers.dialog },
  transition: {
    'transitionDuration': { default: motion.drawerDuration, [conditions.reducedMotion]: '0ms' },
    'transitionTimingFunction': motion.drawerEasing,
    ':is([data-swiping])': { transitionDuration: '0ms' },
  },
  backdrop: { opacity: 'calc(1 - var(--drawer-swipe-progress, 0))' },
  popup: {
    'position': 'absolute',
    'top': 0,
    'bottom': 0,
    'left': 0,
    'display': 'flex',
    'flexDirection': 'column',
    'boxSizing': 'border-box',
    'minWidth': 0,
    'minHeight': 0,
    'maxWidth': '100vw',
    'overflowY': 'auto',
    'overscrollBehavior': 'contain',
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'overflowWrap': 'anywhere',
    'borderRightWidth': 1,
    'borderRightStyle': 'solid',
    'borderRightColor': colors.line,
    'outlineWidth': 0,
    'transform': 'translateX(var(--drawer-swipe-movement-x, 0px))',
    'transitionProperty': 'transform',
    ':is([data-starting-style], [data-ending-style])': { transform: 'translateX(-100%)' },
  },
});

type DrawerRootProps<Payload> = Omit<
  BaseDrawer.Root.Props<Payload>,
  | 'open'
  | 'defaultOpen'
  | 'onOpenChange'
  | 'swipeDirection'
  | 'snapPoints'
  | 'snapPoint'
  | 'defaultSnapPoint'
  | 'onSnapPointChange'
  | 'snapToSequentialPoints'
> &
  OpenStateProperties<NonNullable<BaseDrawer.Root.Props<Payload>['onOpenChange']>>;

type DrawerBackdropProps = ComponentProps<typeof BaseDrawer.Backdrop>;
type DrawerViewportProps = ComponentProps<typeof BaseDrawer.Viewport>;
type DrawerPopupProps = ComponentProps<typeof BaseDrawer.Popup> & { readonly xstyle?: PlacementStyle };
type DrawerTitleProps = ComponentProps<typeof BaseDrawer.Title> & { readonly isVisuallyHidden?: boolean };
type DrawerDescriptionProps = ComponentProps<typeof BaseDrawer.Description>;

function DrawerRoot<Payload = unknown>(props: DrawerRootProps<Payload>): ReactNode {
  return <BaseDrawer.Root<Payload> {...props} swipeDirection="left" />;
}

function DrawerBackdrop({ className, style, ...props }: DrawerBackdropProps): ReactNode {
  return (
    <BaseDrawer.Backdrop
      {...props}
      {...mergeStyles<BaseDrawer.Backdrop.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.backdrop, styles.transition, styles.backdrop),
      })}
    />
  );
}

function DrawerViewport({ className, style, ...props }: DrawerViewportProps): ReactNode {
  return (
    <BaseDrawer.Viewport
      {...props}
      {...mergeStyles<BaseDrawer.Viewport.State>({ className, style, styles: stylex.props(styles.viewport) })}
    />
  );
}

function DrawerPopup({ className, style, xstyle, ...props }: DrawerPopupProps): ReactNode {
  return (
    <BaseDrawer.Popup
      {...props}
      {...mergeStyles<BaseDrawer.Popup.State>({
        className,
        style,
        styles: stylex.props(styles.transition, styles.popup, xstyle),
      })}
    />
  );
}

function DrawerTitle({ className, style, isVisuallyHidden = false, ...props }: DrawerTitleProps): ReactNode {
  return (
    <BaseDrawer.Title
      {...props}
      {...mergeStyles<BaseDrawer.Title.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.title, isVisuallyHidden && accessibility.hidden),
      })}
    />
  );
}

function DrawerDescription({ className, style, ...props }: DrawerDescriptionProps): ReactNode {
  return (
    <BaseDrawer.Description
      {...props}
      {...mergeStyles<BaseDrawer.Description.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.description),
      })}
    />
  );
}

export const Drawer = {
  createHandle: BaseDrawer.createHandle,
  Root: DrawerRoot,
  Trigger: BaseDrawer.Trigger,
  Portal: BaseDrawer.Portal,
  Backdrop: DrawerBackdrop,
  Viewport: DrawerViewport,
  Popup: DrawerPopup,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: BaseDrawer.Close,
};

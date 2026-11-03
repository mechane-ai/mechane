import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import { colors, conditions, layers, motion, typography } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { accessibility } from './accessibility.ts';
import type { OpenStateProperties } from './control-state.ts';
import { overlayStyles } from './overlay-styles.ts';
import { mergeStyles } from './style-composition.ts';
import type { PlacementStyle } from './style-composition.ts';

const styles = stylex.create({
  viewport: { position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: layers.dialog },
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
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'borderRightWidth': 1,
    'borderRightStyle': 'solid',
    'borderRightColor': colors.line,
    'outlineWidth': 0,
    'transitionProperty': 'transform',
    'transitionDuration': { default: motion.duration, [conditions.reducedMotion]: '0ms' },
    'transitionTimingFunction': motion.easing,
    ':is([data-swiping])': { transitionDuration: '0ms' },
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
type DrawerTitleProps = ComponentProps<typeof BaseDrawer.Title> & { readonly visuallyHidden?: boolean };
type DrawerDescriptionProps = ComponentProps<typeof BaseDrawer.Description>;

function DrawerRoot<Payload = unknown>(props: DrawerRootProps<Payload>): ReactNode {
  return <BaseDrawer.Root<Payload> {...props} swipeDirection="left" />;
}

function DrawerBackdrop({ className, style, ...props }: DrawerBackdropProps): ReactNode {
  return (
    <BaseDrawer.Backdrop
      {...props}
      {...mergeStyles<BaseDrawer.Backdrop.State>({ className, style, styles: stylex.props(overlayStyles.backdrop) })}
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
      {...mergeStyles<BaseDrawer.Popup.State>({ className, style, styles: stylex.props(styles.popup, xstyle) })}
    />
  );
}

function DrawerTitle({ className, style, visuallyHidden = false, ...props }: DrawerTitleProps): ReactNode {
  return (
    <BaseDrawer.Title
      {...props}
      {...mergeStyles<BaseDrawer.Title.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.title, visuallyHidden && accessibility.hidden),
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

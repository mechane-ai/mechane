import * as stylex from '@stylexjs/stylex';
import * as SDK from '@ui-sdk/react/drawer';
import type { ComponentProps, ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

const styles = stylex.create({
  popup: {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: 0,
    maxWidth: '100vw',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: colors.line,
    outlineWidth: 0,
  },
});

function Root(
  props: OpenProps<
    Omit<SDK.DrawerProps, 'side' | 'snapPoints' | 'snapPoint' | 'defaultSnapPoint' | 'onSnapPointChange'>
  >,
): ReactNode {
  return <SDK.Drawer {...props} side="left" />;
}

function Backdrop({ className, style, ...props }: ComponentProps<typeof SDK.DrawerBackdrop>): ReactNode {
  return (
    <SDK.DrawerBackdrop
      {...props}
      {...mergeStyles<SDK.DrawerBackdropState>({ className, style, styles: stylex.props(overlayStyles.backdrop) })}
    />
  );
}

function Popup({
  className,
  style,
  xstyle,
  ...props
}: ComponentProps<typeof SDK.DrawerContent> & { readonly xstyle?: PlacementStyle }): ReactNode {
  return (
    <SDK.DrawerContent
      {...props}
      {...mergeStyles<SDK.DrawerContentState>({ className, style, styles: stylex.props(styles.popup, xstyle) })}
    />
  );
}

function Title({
  className,
  style,
  isVisuallyHidden = false,
  ...props
}: ComponentProps<typeof SDK.DrawerTitle> & { readonly isVisuallyHidden?: boolean }): ReactNode {
  return (
    <SDK.DrawerTitle
      {...props}
      {...mergeStyles({
        className,
        style,
        styles: stylex.props(overlayStyles.title, isVisuallyHidden && accessibility.hidden),
      })}
    />
  );
}

function Description({ className, style, ...props }: ComponentProps<typeof SDK.DrawerDescription>): ReactNode {
  return (
    <SDK.DrawerDescription
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(overlayStyles.description) })}
    />
  );
}

export const Drawer = {
  createController: SDK.createDrawerController,
  Root: withOverlayPortal(Root),
  Trigger: SDK.DrawerTrigger,
  Backdrop,
  Popup,
  Title,
  Description,
  Close: SDK.DrawerClose,
};

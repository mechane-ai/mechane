import * as stylex from '@stylexjs/stylex';
import * as SDK from '@ui-sdk/react/dialog';
import type { ComponentProps, ReactNode } from 'react';
import { layers } from '../../foundations/src/constants.stylex.ts';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

const styles = stylex.create({
  popup: {
    'position': 'fixed',
    'top': '50%',
    'left': '50%',
    'transform': 'translate(-50%, -50%)',
    'opacity': 1,
    'zIndex': layers.dialog,
    'boxSizing': 'border-box',
    'width': 'min(440px, calc(100vw - 32px))',
    'maxHeight': 'calc(100dvh - 32px)',
    'overflowY': 'auto',
    'overscrollBehavior': 'contain',
    'padding': spacing.xl,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.md,
    'boxShadow': shadows.popup,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'overflowWrap': 'anywhere',
    'WebkitFontSmoothing': 'antialiased',
    'outlineWidth': 0,
    ':is([data-starting-style], [data-ending-style])': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.98)' },
  },
});

type DialogMotion = 'standard' | 'none';

const motionStyles = stylex.create<Record<DialogMotion, stylex.CSSProperties>>({
  standard: {},
  none: { transitionDuration: '0ms' },
});

export function styledDialogParts(parts: {
  Backdrop: typeof SDK.DialogBackdrop;
  Content: typeof SDK.DialogContent;
  Title: typeof SDK.DialogTitle;
  Description: typeof SDK.DialogDescription;
}) {
  function Backdrop({
    className,
    style,
    motion = 'standard',
    ...props
  }: ComponentProps<typeof parts.Backdrop> & { readonly motion?: DialogMotion }): ReactNode {
    return (
      <parts.Backdrop
        {...props}
        {...mergeStyles<SDK.DialogBackdropState>({
          className,
          style,
          styles: stylex.props(overlayStyles.transition, overlayStyles.backdrop, motionStyles[motion]),
        })}
      />
    );
  }

  function Popup({
    className,
    style,
    xstyle,
    motion = 'standard',
    ...props
  }: ComponentProps<typeof parts.Content> & {
    readonly xstyle?: PlacementStyle;
    readonly motion?: DialogMotion;
  }): ReactNode {
    return (
      <parts.Content
        {...props}
        {...mergeStyles<SDK.DialogContentState>({
          className,
          style,
          styles: stylex.props(
            overlayStyles.content,
            overlayStyles.transition,
            styles.popup,
            motionStyles[motion],
            xstyle,
          ),
        })}
      />
    );
  }

  function Title({ className, style, ...props }: ComponentProps<typeof parts.Title>): ReactNode {
    return <parts.Title {...props} {...mergeStyles({ className, style, styles: stylex.props(overlayStyles.title) })} />;
  }

  function Description({ className, style, ...props }: ComponentProps<typeof parts.Description>): ReactNode {
    return (
      <parts.Description
        {...props}
        {...mergeStyles({ className, style, styles: stylex.props(overlayStyles.description) })}
      />
    );
  }

  return { Backdrop, Popup, Title, Description };
}

function Root(props: OpenProps<SDK.DialogProps>): ReactNode {
  return <SDK.Dialog {...props} />;
}

export const Dialog = {
  Root: withOverlayPortal(Root),
  Trigger: SDK.DialogTrigger,
  Close: SDK.DialogClose,
  ...styledDialogParts({
    Backdrop: SDK.DialogBackdrop,
    Content: SDK.DialogContent,
    Title: SDK.DialogTitle,
    Description: SDK.DialogDescription,
  }),
};

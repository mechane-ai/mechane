import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, layers, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

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

type DialogRootProps<Payload> = Omit<BaseDialog.Root.Props<Payload>, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BaseDialog.Root.Props<Payload>['onOpenChange']>>;

type DialogBackdropProps = ComponentProps<typeof BaseDialog.Backdrop> & { readonly motion?: DialogMotion };

type DialogPopupProps = ComponentProps<typeof BaseDialog.Popup> & {
  readonly xstyle?: PlacementStyle;
  readonly motion?: DialogMotion;
};

type DialogTitleProps = ComponentProps<typeof BaseDialog.Title>;
type DialogDescriptionProps = ComponentProps<typeof BaseDialog.Description>;

function DialogRoot<Payload = unknown>(props: DialogRootProps<Payload>): ReactNode {
  return <BaseDialog.Root<Payload> {...props} />;
}

function DialogBackdrop({ className, style, motion = 'standard', ...props }: DialogBackdropProps): ReactNode {
  return (
    <BaseDialog.Backdrop
      {...props}
      {...mergeStyles<BaseDialog.Backdrop.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.transition, overlayStyles.backdrop, motionStyles[motion]),
      })}
    />
  );
}

function DialogPopup({ className, style, xstyle, motion = 'standard', ...props }: DialogPopupProps): ReactNode {
  return (
    <BaseDialog.Popup
      {...props}
      {...mergeStyles<BaseDialog.Popup.State>({
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

function DialogTitle({ className, style, ...props }: DialogTitleProps): ReactNode {
  return (
    <BaseDialog.Title
      {...props}
      {...mergeStyles<BaseDialog.Title.State>({ className, style, styles: stylex.props(overlayStyles.title) })}
    />
  );
}

function DialogDescription({ className, style, ...props }: DialogDescriptionProps): ReactNode {
  return (
    <BaseDialog.Description
      {...props}
      {...mergeStyles<BaseDialog.Description.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.description),
      })}
    />
  );
}

export const Dialog = {
  Root: DialogRoot,
  Trigger: BaseDialog.Trigger,
  Portal: BaseDialog.Portal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: BaseDialog.Close,
};

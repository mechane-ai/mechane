import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, layers, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  positioner: { zIndex: layers.tooltip },
  popup: {
    maxWidth: 'min(280px, calc(100vw - 24px))',
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
    color: colors.inverse,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    boxShadow: shadows.popup,
    overflowWrap: 'anywhere',
  },
});

type TooltipRootProps<Payload> = Omit<BaseTooltip.Root.Props<Payload>, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BaseTooltip.Root.Props<Payload>['onOpenChange']>>;

type TooltipPositionerProps = ComponentProps<typeof BaseTooltip.Positioner>;
type TooltipPopupProps = ComponentProps<typeof BaseTooltip.Popup>;

function TooltipRoot<Payload = unknown>(props: TooltipRootProps<Payload>): ReactNode {
  return <BaseTooltip.Root<Payload> {...props} />;
}

function TooltipPositioner({ className, style, sideOffset = 6, ...props }: TooltipPositionerProps): ReactNode {
  return (
    <BaseTooltip.Positioner
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<BaseTooltip.Positioner.State>({ className, style, styles: stylex.props(styles.positioner) })}
    />
  );
}

function TooltipPopup({ className, style, ...props }: TooltipPopupProps): ReactNode {
  return (
    <BaseTooltip.Popup
      {...props}
      {...mergeStyles<BaseTooltip.Popup.State>({ className, style, styles: stylex.props(styles.popup) })}
    />
  );
}

export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: TooltipRoot,
  Trigger: BaseTooltip.Trigger,
  Portal: BaseTooltip.Portal,
  Positioner: TooltipPositioner,
  Popup: TooltipPopup,
};

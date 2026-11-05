import { Popover as BasePopover } from '@base-ui/react/popover';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';

type PopoverRootProps<Payload> = Omit<BasePopover.Root.Props<Payload>, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BasePopover.Root.Props<Payload>['onOpenChange']>>;

type PopoverPositionerProps = ComponentProps<typeof BasePopover.Positioner>;
type PopoverPopupProps = ComponentProps<typeof BasePopover.Popup>;
type PopoverTitleProps = ComponentProps<typeof BasePopover.Title>;
type PopoverDescriptionProps = ComponentProps<typeof BasePopover.Description>;

function PopoverRoot<Payload = unknown>(props: PopoverRootProps<Payload>): ReactNode {
  return <BasePopover.Root<Payload> {...props} />;
}

function PopoverPositioner({ className, style, sideOffset = 4, ...props }: PopoverPositionerProps): ReactNode {
  return (
    <BasePopover.Positioner
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<BasePopover.Positioner.State>({ className, style, styles: stylex.props(popupStyles.positioner) })}
    />
  );
}

function PopoverPopup({ className, style, ...props }: PopoverPopupProps): ReactNode {
  return (
    <BasePopover.Popup
      {...props}
      {...mergeStyles<BasePopover.Popup.State>({
        className,
        style,
        styles: stylex.props(popupStyles.surface, popupStyles.content),
      })}
    />
  );
}

function PopoverTitle({ className, style, ...props }: PopoverTitleProps): ReactNode {
  return (
    <BasePopover.Title
      {...props}
      {...mergeStyles<BasePopover.Title.State>({ className, style, styles: stylex.props(overlayStyles.title) })}
    />
  );
}

function PopoverDescription({ className, style, ...props }: PopoverDescriptionProps): ReactNode {
  return (
    <BasePopover.Description
      {...props}
      {...mergeStyles<BasePopover.Description.State>({
        className,
        style,
        styles: stylex.props(overlayStyles.description),
      })}
    />
  );
}

export const Popover = {
  Root: PopoverRoot,
  Trigger: BasePopover.Trigger,
  Portal: BasePopover.Portal,
  Positioner: PopoverPositioner,
  Popup: PopoverPopup,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: BasePopover.Close,
};

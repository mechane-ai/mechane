import * as stylex from '@stylexjs/stylex';
import * as SDK from '@ui-sdk/react/popover';
import type { ComponentProps, ReactNode } from 'react';
import { overlayStyles } from '../../foundations/src/overlay-styles.ts';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

function Root(props: OpenProps<SDK.PopoverProps>): ReactNode {
  return <SDK.Popover {...props} />;
}

function Popup({ className, style, sideOffset = 4, ...props }: ComponentProps<typeof SDK.PopoverContent>): ReactNode {
  return (
    <SDK.PopoverContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<SDK.PopoverContentState>({
        className,
        style,
        styles: stylex.props(popupStyles.positioner, popupStyles.surface, popupStyles.content),
      })}
    />
  );
}

function Title({ className, style, ...props }: ComponentProps<typeof SDK.PopoverTitle>): ReactNode {
  return (
    <SDK.PopoverTitle {...props} {...mergeStyles({ className, style, styles: stylex.props(overlayStyles.title) })} />
  );
}

function Description({ className, style, ...props }: ComponentProps<typeof SDK.PopoverDescription>): ReactNode {
  return (
    <SDK.PopoverDescription
      {...props}
      {...mergeStyles({ className, style, styles: stylex.props(overlayStyles.description) })}
    />
  );
}

export const Popover = {
  Root: withOverlayPortal(Root),
  Trigger: SDK.PopoverTrigger,
  Popup,
  Title,
  Description,
  Close: SDK.PopoverClose,
};

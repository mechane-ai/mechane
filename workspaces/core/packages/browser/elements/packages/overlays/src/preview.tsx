import * as stylex from '@stylexjs/stylex';
import * as SDK from '@ui-sdk/react/hover-card';
import type { ComponentProps, ReactNode } from 'react';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

function Root(props: OpenProps<SDK.HoverCardProps>): ReactNode {
  return <SDK.HoverCard {...props} />;
}

function Popup({ className, style, sideOffset = 4, ...props }: ComponentProps<typeof SDK.HoverCardContent>): ReactNode {
  return (
    <SDK.HoverCardContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<SDK.HoverCardContentState>({
        className,
        style,
        styles: stylex.props(popupStyles.positioner, popupStyles.surface, popupStyles.content),
      })}
    />
  );
}

export const Preview = { Root: withOverlayPortal(Root), Trigger: SDK.HoverCardTrigger, Popup };

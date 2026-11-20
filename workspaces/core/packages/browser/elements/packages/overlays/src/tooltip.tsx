import * as stylex from '@stylexjs/stylex';
import type {
  TooltipContentProps,
  TooltipContentState,
  TooltipOptions,
  TooltipTriggerProps,
  TooltipTriggerState,
} from '@ui-sdk/core/tooltip';
import type { PartProps } from '@ui-sdk/react/primitive';
import * as SDK from '@ui-sdk/react/tooltip';
import type { ReactNode } from 'react';
import { layers } from '../../foundations/src/constants.stylex.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { colors, radii, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

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
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    boxShadow: shadows.popup,
    overflowWrap: 'anywhere',
  },
});

type RootProps = OpenProps<TooltipOptions> & { readonly children?: ReactNode };

type TriggerProps = Omit<PartProps<'button', TooltipTriggerState>, 'value' | 'defaultValue' | 'onChange'> &
  TooltipTriggerProps;

type PopupProps = PartProps<'div', TooltipContentState> & TooltipContentProps;

function Root(props: RootProps): ReactNode {
  return <SDK.Tooltip {...props} />;
}

function Popup({ className, style, sideOffset = 4, ...props }: PopupProps): ReactNode {
  return (
    <SDK.TooltipContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<TooltipContentState>({ className, style, styles: stylex.props(styles.positioner, styles.popup) })}
    />
  );
}

export const Tooltip: {
  Root: (props: RootProps) => ReactNode;
  Trigger: (props: TriggerProps) => ReactNode;
  Popup: (props: PopupProps) => ReactNode;
} = { Root: withOverlayPortal(Root), Trigger: SDK.TooltipTrigger, Popup };

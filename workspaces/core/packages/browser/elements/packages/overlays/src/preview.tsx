import { PreviewCard as BasePreview } from '@base-ui/react/preview-card';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';

type PreviewRootProps<Payload> = Omit<BasePreview.Root.Props<Payload>, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BasePreview.Root.Props<Payload>['onOpenChange']>>;

type PreviewPositionerProps = ComponentProps<typeof BasePreview.Positioner>;
type PreviewPopupProps = ComponentProps<typeof BasePreview.Popup>;

function PreviewRoot<Payload = unknown>(props: PreviewRootProps<Payload>): ReactNode {
  return <BasePreview.Root<Payload> {...props} />;
}

function PreviewPositioner({ className, style, sideOffset = 4, ...props }: PreviewPositionerProps): ReactNode {
  return (
    <BasePreview.Positioner
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<BasePreview.Positioner.State>({ className, style, styles: stylex.props(popupStyles.positioner) })}
    />
  );
}

function PreviewPopup({ className, style, ...props }: PreviewPopupProps): ReactNode {
  return (
    <BasePreview.Popup
      {...props}
      {...mergeStyles<BasePreview.Popup.State>({
        className,
        style,
        styles: stylex.props(popupStyles.surface, popupStyles.content),
      })}
    />
  );
}

export const Preview = {
  Root: PreviewRoot,
  Trigger: BasePreview.Trigger,
  Portal: BasePreview.Portal,
  Positioner: PreviewPositioner,
  Popup: PreviewPopup,
};

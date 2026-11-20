import * as SDK from '@ui-sdk/react/alert-dialog';
import type { ReactNode } from 'react';
import { styledDialogParts } from './dialog.tsx';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

function Root(props: OpenProps<SDK.AlertDialogProps>): ReactNode {
  return <SDK.AlertDialog {...props} />;
}

export const AlertDialog = {
  Root: withOverlayPortal(Root),
  Trigger: SDK.AlertDialogTrigger,
  Close: SDK.AlertDialogClose,
  ...styledDialogParts({
    Backdrop: SDK.AlertDialogBackdrop,
    Content: SDK.AlertDialogContent,
    Title: SDK.AlertDialogTitle,
    Description: SDK.AlertDialogDescription,
  }),
};

import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import type { ReactNode } from 'react';
import type { OpenStateProperties } from './control-state.ts';
import { Dialog } from './dialog.tsx';

type AlertDialogRootProps<Payload> = Omit<
  BaseAlertDialog.Root.Props<Payload>,
  'open' | 'defaultOpen' | 'onOpenChange'
> &
  OpenStateProperties<NonNullable<BaseAlertDialog.Root.Props<Payload>['onOpenChange']>>;

function AlertDialogRoot<Payload = unknown>(props: AlertDialogRootProps<Payload>): ReactNode {
  return <BaseAlertDialog.Root<Payload> {...props} />;
}

export const AlertDialog = {
  Root: AlertDialogRoot,
  Trigger: BaseAlertDialog.Trigger,
  Portal: Dialog.Portal,
  Backdrop: Dialog.Backdrop,
  Popup: Dialog.Popup,
  Title: Dialog.Title,
  Description: Dialog.Description,
  Close: Dialog.Close,
};

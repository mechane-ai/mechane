import { Button, Row } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { AlertDialog } from '@mechane-ai/elements/overlays';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useManagedCommand } from '../managed-command.ts';

export function ArchiveManagedResource({
  kind,
  name,
  archive,
}: {
  readonly kind: 'agent' | 'session';
  readonly name: string;
  readonly archive: () => Promise<void>;
}): ReactNode {
  const [isOpen, setOpen] = useState(false);
  const command = useManagedCommand();
  const isPending = command.pending !== undefined;
  const label = `Archive ${kind}`;

  return (
    <AlertDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!isPending) {
          setOpen(open);
        }
      }}
    >
      <AlertDialog.Trigger render={<Button variant="ghost" />}>{label}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Popup>
          <AlertDialog.Title>Archive {name}?</AlertDialog.Title>
          <AlertDialog.Description>
            {kind === 'agent'
              ? 'This agent will leave the directory. Its existing sessions retain their history.'
              : 'This session will leave the session list and stop accepting messages. Its history stays available.'}
          </AlertDialog.Description>
          {command.error !== undefined && <Notice hasError>{command.error}</Notice>}
          <Row>
            <AlertDialog.Close render={<Button disabled={isPending} />}>Cancel</AlertDialog.Close>
            <Button
              tone="danger"
              variant="solid"
              disabled={isPending}
              onClick={() => command.run('archive', archive, () => setOpen(false))}
            >
              {label}
            </Button>
          </Row>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

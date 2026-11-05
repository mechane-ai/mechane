import {
  agentAppearance,
  AgentAvatar,
  Button,
  Collapsible,
  CopyValue,
  Muted,
  Row,
  Stack,
  Subheading,
} from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { Notice } from '@mechane-ai/elements/feedback';
import { AgentAvatarPicker } from '@mechane-ai/elements/forms';
import { Dialog } from '@mechane-ai/elements/overlays';
import { moneyLabel } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';

export function MechSettings({
  mech,
  busy,
  error,
  onEdit,
  onArchive,
}: {
  readonly mech: Mech;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const { appearance, setAppearance, persistenceError } = useMechAppearance(mech.id);

  return (
    <Stack>
      <Collapsible.Root>
        <Collapsible.Trigger>
          <Row>
            <AgentAvatar seed={mech.id} appearance={appearance} size="md" />
            <span>Appearance</span>
          </Row>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <Stack compact>
            <AgentAvatarPicker value={appearance ?? agentAppearance(mech.id)} onValueChange={setAppearance} />
            <Row between>
              <Muted>For you in this browser.</Muted>
              <Button variant="ghost" disabled={appearance === undefined} onClick={() => setAppearance(undefined)}>
                Reset icon
              </Button>
            </Row>
            {persistenceError !== undefined && <Notice error>{persistenceError}</Notice>}
          </Stack>
        </Collapsible.Panel>
      </Collapsible.Root>
      <Row between>
        <Subheading>Definition</Subheading>
        <Button onClick={onEdit}>Edit definition</Button>
      </Row>
      <Details
        items={[
          { label: 'Model', value: mech.model },
          { label: 'Daily cap', value: moneyLabel(mech.dailyCapMicros) },
          { label: 'Revision', value: mech.revision },
          { label: 'Active revision', value: mech.activeRevision },
          { label: 'Mech ID', value: <CopyValue label="mech ID" value={mech.id} /> },
        ]}
      />
      <Subheading>Instructions</Subheading>
      <Markdown>{Option.getOrElse(mech.instructions, () => 'No additional instructions.')}</Markdown>
      <Subheading>Archive</Subheading>
      <Muted>Stop accepting new work while keeping this mech’s history and files.</Muted>
      <Dialog.Root
        open={open && mech.status !== 'archived'}
        onOpenChange={(next, details) => {
          if (busy) {
            details.cancel();
          } else {
            setOpen(next);
          }
        }}
      >
        <Dialog.Trigger render={<Button tone="danger" disabled={mech.status === 'archived' || busy} />}>
          Archive mech
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup initialFocus={cancel}>
            <Stack>
              <Dialog.Title>Archive {mech.name}?</Dialog.Title>
              <Dialog.Description>It will stop accepting new work. Its history and files remain.</Dialog.Description>
              {error !== undefined && <Notice error>{error}</Notice>}
              <Row>
                <Button variant="solid" tone="danger" pending={busy} pendingLabel="Archiving…" onClick={onArchive}>
                  Archive mech
                </Button>
                <Dialog.Close render={<Button ref={cancel} disabled={busy} />}>Cancel</Dialog.Close>
              </Row>
            </Stack>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </Stack>
  );
}

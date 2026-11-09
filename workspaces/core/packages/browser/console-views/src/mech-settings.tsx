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
import type { AgentAppearance } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { ButtonPlaceholder, Notice, Skeleton, SkeletonText } from '@mechane-ai/elements/feedback';
import { AgentAvatarPicker, SettingsSection } from '@mechane-ai/elements/forms';
import { Dialog } from '@mechane-ai/elements/overlays';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { moneyLabel } from './format.ts';

function ArchiveSection({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <SettingsSection title="Archive" description="Stop accepting new work while keeping this mech’s history and files.">
      {children}
    </SettingsSection>
  );
}

export function MechSettingsPlaceholder(): ReactNode {
  return (
    <div aria-hidden inert>
      <Stack>
        <Stack isCompact>
          <Row shouldSpaceBetween>
            <Subheading>Definition</Subheading>
            <ButtonPlaceholder width="12ch" />
          </Row>
          <Details
            items={[
              { label: 'Model', value: <SkeletonText width="22ch" /> },
              { label: 'Daily cap', value: <SkeletonText width="8ch" /> },
            ]}
          />
          <Collapsible.Root>
            <Collapsible.Trigger disabled>Instructions</Collapsible.Trigger>
          </Collapsible.Root>
        </Stack>
        <Collapsible.Root>
          <Collapsible.Trigger disabled>
            <Row>
              <Skeleton width={24} height={24} />
              <span>Appearance</span>
            </Row>
          </Collapsible.Trigger>
        </Collapsible.Root>
        <Collapsible.Root>
          <Collapsible.Trigger disabled>Technical details</Collapsible.Trigger>
        </Collapsible.Root>
        <ArchiveSection>
          <ButtonPlaceholder width="12ch" />
        </ArchiveSection>
      </Stack>
    </div>
  );
}

export function MechSettings({
  mech,
  isBusy,
  error,
  appearance,
  onAppearance,
  appearanceError,
  onEdit,
  onArchive,
}: {
  readonly mech: Mech;
  readonly isBusy: boolean;
  readonly error: string | undefined;
  readonly appearance: AgentAppearance | undefined;
  readonly onAppearance: (value: AgentAppearance | undefined) => void;
  readonly appearanceError: string | undefined;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
}): ReactNode {
  const [isOpen, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  return (
    <Stack>
      <Stack isCompact>
        <Row shouldSpaceBetween>
          <Subheading>Definition</Subheading>
          <Button onClick={onEdit}>Edit definition</Button>
        </Row>
        <Details
          items={[
            { label: 'Model', value: mech.model },
            { label: 'Daily cap', value: moneyLabel(mech.dailyCapMicros) },
          ]}
        />
        <Collapsible.Root>
          <Collapsible.Trigger>Instructions</Collapsible.Trigger>
          <Collapsible.Panel>
            <Markdown>{Option.getOrElse(mech.instructions, () => 'No additional instructions.')}</Markdown>
          </Collapsible.Panel>
        </Collapsible.Root>
      </Stack>
      <Collapsible.Root>
        <Collapsible.Trigger>
          <Row>
            <AgentAvatar seed={mech.id} appearance={appearance} size="md" />
            <span>Appearance</span>
          </Row>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <Stack isCompact>
            <AgentAvatarPicker value={appearance ?? agentAppearance(mech.id)} onValueChange={onAppearance} />
            <Row shouldSpaceBetween>
              <Muted>For you in this browser.</Muted>
              <Button variant="ghost" disabled={appearance === undefined} onClick={() => onAppearance(undefined)}>
                Reset icon
              </Button>
            </Row>
            {appearanceError !== undefined && <Notice hasError>{appearanceError}</Notice>}
          </Stack>
        </Collapsible.Panel>
      </Collapsible.Root>
      <Collapsible.Root>
        <Collapsible.Trigger>Technical details</Collapsible.Trigger>
        <Collapsible.Panel>
          <Details
            items={[
              { label: 'Revision', value: mech.revision },
              { label: 'Active revision', value: mech.activeRevision },
              { label: 'Mech ID', value: <CopyValue label="mech ID" value={mech.id} /> },
            ]}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
      <ArchiveSection>
        <Dialog.Root
          open={isOpen && mech.status !== 'archived'}
          onOpenChange={(next, details) => {
            if (isBusy) {
              details.cancel();
            } else {
              setOpen(next);
            }
          }}
        >
          <Dialog.Trigger render={<Button tone="danger" disabled={mech.status === 'archived' || isBusy} />}>
            Archive mech
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup initialFocus={cancel}>
              <Stack>
                <Dialog.Title>Archive {mech.name}?</Dialog.Title>
                <Dialog.Description>It will stop accepting new work. Its history and files remain.</Dialog.Description>
                {error !== undefined && <Notice hasError>{error}</Notice>}
                <Row>
                  <Button
                    variant="solid"
                    tone="danger"
                    isPending={isBusy}
                    pendingLabel="Archiving…"
                    onClick={onArchive}
                  >
                    Archive mech
                  </Button>
                  <Dialog.Close render={<Button ref={cancel} disabled={isBusy} />}>Cancel</Dialog.Close>
                </Row>
              </Stack>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </ArchiveSection>
    </Stack>
  );
}

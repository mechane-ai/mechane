import {
  Button,
  CopyValue,
  Dialog,
  Heading,
  Muted,
  Notice,
  Panel,
  Prose,
  Row,
  Stack,
  Status,
  Subheading,
  Tabs,
} from '@mechane-ai/ui';
import { DetailPage, PageToolbar, ToolbarAction } from '@mechane-ai/ui/layout';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { moneyLabel } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { Pause, Pencil, Play, Send } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { ActivityScreen } from './activity.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';
import { TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);

  return (
    <Resource data={data} source={source} fallbackHeader={<PageToolbar title="Mech" />} label="Loading mech">
      {(mech, notice) => (
        <MechDetails data={data} mech={mech} notice={notice} location={location} navigate={navigate} />
      )}
    </Resource>
  );
}

function MechDetails({
  data,
  mech,
  location,
  navigate,
  notice,
}: Omit<MechNavigation, 'mechId'> & { readonly mech: Mech; readonly notice: ReactNode }): ReactNode {
  const tab = location.view === 'activity' ? 'Activity' : location.view === 'definition' ? 'Definition' : 'Turns';
  const base = { workspace: data.workspace.id, mech: mech.id };
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MechStatus>();
  const [error, setError] = useState<string>();
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const archiveCancel = useRef<HTMLButtonElement>(null);
  const statusAction = useRef<HTMLButtonElement>(null);
  const isScreenActive = useScreenLifetime();
  const busy = pendingStatus !== undefined;
  const isArchiveDisabled = mech.status === 'archived' || busy;

  function setStatus(status: MechStatus): void {
    if (busy) {
      return;
    }

    setPendingStatus(status);
    setError(undefined);
    void data.update(mech, { status }).then(
      () => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
          setArchiveConfirm(false);
        }
      },
      (cause: unknown) => {
        if (isScreenActive()) {
          setPendingStatus(undefined);
          setError(problemMessage(cause));
        }
      },
    );
  }

  if (editing) {
    return <EditMechForm data={data} mech={mech} notice={notice} onClose={() => setEditing(false)} />;
  }

  if (location.turn !== undefined) {
    return (
      <TraceScreen
        key={location.turn}
        data={data}
        mech={mech}
        notice={notice}
        turnId={location.turn}
        location={location}
        navigate={navigate}
      />
    );
  }

  return (
    <>
      <PageToolbar
        breadcrumb
        title={
          <>
            <ConsoleLink to={{ workspace: data.workspace.id }}>Mechs</ConsoleLink> / {mech.name}
          </>
        }
        actions={
          <>
            <ToolbarAction
              ref={statusAction}
              icon={mech.status === 'active' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              disabled={busy}
              pending={busy && pendingStatus !== MechStatus.Archived}
              pendingLabel={pendingStatus === MechStatus.Paused ? 'Pausing…' : 'Activating…'}
              onClick={() => setStatus(mech.status === 'active' ? MechStatus.Paused : MechStatus.Active)}
            >
              {mech.status === 'active' ? 'Pause' : 'Activate'}
            </ToolbarAction>
            <ToolbarAction icon={<Pencil size={16} aria-hidden />} onClick={() => setEditing(true)}>
              Edit definition
            </ToolbarAction>
            <ToolbarAction
              icon={<Send size={16} aria-hidden />}
              disabled={mech.status === 'archived'}
              onClick={() => setMessage((value) => !value)}
            >
              Send message
            </ToolbarAction>
          </>
        }
      />
      {notice}
      <DetailPage>
        <Stack>
          <Stack compact>
            <Row>
              <Heading>{mech.name}</Heading>
              <Status tone={mech.status === 'active' ? 'positive' : 'neutral'}>{mech.status}</Status>
            </Row>
            <Muted>
              {mech.model} · Revision {mech.revision}
            </Muted>
            <Row>
              <CopyValue label="mech ID" value={mech.id} />
            </Row>
          </Stack>
          {error !== undefined && !archiveConfirm && <Notice error>{error}</Notice>}
          {mech.status === 'paused' && (
            <Notice>
              Paused. New messages wait in the inbox until you activate this mech. A running turn may still finish.
            </Notice>
          )}
          {message && <MessageForm data={data} mech={mech} onClose={() => setMessage(false)} />}
          <Tabs.Root
            value={tab}
            onValueChange={(next) =>
              navigate(next === 'Turns' ? base : { ...base, view: next === 'Activity' ? 'activity' : 'definition' })
            }
          >
            <Tabs.List aria-label="Mech details">
              <Tabs.Tab value="Turns">Turns</Tabs.Tab>
              <Tabs.Tab value="Activity">Activity</Tabs.Tab>
              <Tabs.Tab value="Definition">Definition</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="Turns">
              {tab === 'Turns' && <TurnsScreen data={data} mech={mech} onMessage={() => setMessage(true)} />}
            </Tabs.Panel>
            <Tabs.Panel value="Activity">
              {tab === 'Activity' && <ActivityScreen data={data} mechId={mech.id} />}
            </Tabs.Panel>
            <Tabs.Panel value="Definition">
              {tab === 'Definition' && (
                <Stack>
                  <Panel>
                    <Stack>
                      <Row between>
                        <Subheading>Saved definition</Subheading>
                        <Muted>Active revision {mech.activeRevision}</Muted>
                      </Row>
                      <Muted>Daily cap: {moneyLabel(mech.dailyCapMicros)}</Muted>
                      <Prose>{Option.getOrElse(mech.instructions, () => 'No additional instructions.')}</Prose>
                    </Stack>
                  </Panel>
                  <Row>
                    <Dialog.Root
                      open={archiveConfirm}
                      onOpenChange={(open, details) => {
                        if (busy) {
                          details.cancel();

                          return;
                        }

                        setArchiveConfirm(open);

                        if (open) {
                          setError(undefined);
                        }
                      }}
                    >
                      <Dialog.Trigger render={<Button tone="danger" disabled={isArchiveDisabled} />}>
                        Archive mech
                      </Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Backdrop />
                        <Dialog.Popup
                          initialFocus={archiveCancel}
                          finalFocus={() => (mech.status === 'archived' ? statusAction.current : true)}
                        >
                          <Stack>
                            <Dialog.Title>Archive {mech.name}?</Dialog.Title>
                            <Dialog.Description>
                              This mech will stop accepting new work. Its history and files remain.
                            </Dialog.Description>
                            {error !== undefined && <Notice error>{error}</Notice>}
                            <Row>
                              <Button
                                variant="solid"
                                tone="danger"
                                pending={pendingStatus === MechStatus.Archived}
                                pendingLabel="Archiving…"
                                onClick={() => setStatus(MechStatus.Archived)}
                              >
                                Archive mech
                              </Button>
                              <Dialog.Close render={<Button ref={archiveCancel} disabled={busy} />}>
                                Cancel
                              </Dialog.Close>
                            </Row>
                          </Stack>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </Row>
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs.Root>
        </Stack>
      </DetailPage>
    </>
  );
}

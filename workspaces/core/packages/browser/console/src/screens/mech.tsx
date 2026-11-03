import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { moneyLabel } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import {
  Button,
  CopyValue,
  DetailPage,
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
  Toolbar,
  ToolbarAction,
} from '@mechane/ui';
import { Option } from 'effect';
import { Pause, Pencil, Play, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { ActivityScreen } from './activity.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';
import { TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';

type MechNavigation = ConsoleNavigation & { readonly data: ConsoleData; readonly mechId: string };

export function MechScreen({ data, mechId, location, navigate }: MechNavigation): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);

  return (
    <Resource data={data} source={source} fallbackHeader={<Toolbar title="Mech" />} label="Loading mech">
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const isArchiveDisabled = mech.status === 'archived' || busy;

  function setStatus(status: MechStatus): void {
    setBusy(true);
    setError(undefined);
    void data.update(mech, { status }).then(
      () => {
        setBusy(false);
        setArchiveConfirm(false);
      },
      (cause: unknown) => {
        setBusy(false);
        setError(problemMessage(cause));
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
      <Toolbar
        breadcrumb
        title={
          <>
            <ConsoleLink to={{ workspace: data.workspace.id }}>Mechs</ConsoleLink> / {mech.name}
          </>
        }
        actions={
          <>
            <ToolbarAction
              icon={mech.status === 'active' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              disabled={busy}
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
          {error !== undefined && <Notice error>{error}</Notice>}
          {mech.status === 'paused' && (
            <Notice>
              Paused. New messages wait in the inbox until you activate this mech. A running turn may still finish.
            </Notice>
          )}
          {message && <MessageForm data={data} mech={mech} onClose={() => setMessage(false)} />}
          <Tabs
            label="Mech details"
            options={['Turns', 'Activity', 'Definition']}
            value={tab}
            onChange={(next) =>
              navigate(next === 'Turns' ? base : { ...base, view: next === 'Activity' ? 'activity' : 'definition' })
            }
          >
            <Stack>
              {tab === 'Turns' && <TurnsScreen data={data} mech={mech} onMessage={() => setMessage(true)} />}
              {tab === 'Activity' && <ActivityScreen data={data} mechId={mech.id} />}
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
                    <Button tone="danger" disabled={isArchiveDisabled} onClick={() => setArchiveConfirm(true)}>
                      Archive mech
                    </Button>
                    {archiveConfirm && (
                      <>
                        <Muted>Archive and stop accepting new work? Its history and files remain.</Muted>
                        <Button tone="danger" disabled={busy} onClick={() => setStatus(MechStatus.Archived)}>
                          Confirm archive
                        </Button>
                        <Button onClick={() => setArchiveConfirm(false)}>Cancel</Button>
                      </>
                    )}
                  </Row>
                </Stack>
              )}
            </Stack>
          </Tabs>
        </Stack>
      </DetailPage>
    </>
  );
}

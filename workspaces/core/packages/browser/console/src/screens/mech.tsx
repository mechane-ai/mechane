import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Activity, moneyLabel, TurnList, TurnTrace } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { Mech, Turn } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import {
  Badge,
  Button,
  Heading,
  Identifier,
  Muted,
  Notice,
  Panel,
  Prose,
  Row,
  Stack,
  Subheading,
  Tabs,
} from '@mechane/ui';
import { Option, Schema } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';

type MechNavigation = {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly turnId: string | undefined;
  readonly onBack: () => void;
  readonly onTurn: (id: string | undefined) => void;
};

export function MechScreen({ data, mechId, turnId, onBack, onTurn }: MechNavigation): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);

  return (
    <Resource data={data} source={source}>
      {(mech) => <MechDetails data={data} mech={mech} turnId={turnId} onBack={onBack} onTurn={onTurn} />}
    </Resource>
  );
}

function MechDetails({
  data,
  mech,
  turnId,
  onBack,
  onTurn,
}: Omit<MechNavigation, 'mechId'> & { readonly mech: Mech }): ReactNode {
  const [tab, setTab] = useState<'Turns' | 'Activity' | 'Definition'>('Turns');
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
    return <EditMechForm data={data} mech={mech} onClose={() => setEditing(false)} />;
  }

  if (turnId !== undefined) {
    return <TraceScreen data={data} mech={mech} turnId={turnId} onBack={() => onTurn(undefined)} />;
  }

  return (
    <Stack>
      <Row>
        <Button tone="quiet" onClick={onBack}>
          ← Mechs
        </Button>
        <Identifier>{mech.id}</Identifier>
      </Row>
      <Row between>
        <Stack compact>
          <Row>
            <Heading>{mech.name}</Heading>
            <Badge tone={mech.status === 'active' ? 'positive' : 'neutral'}>{mech.status}</Badge>
          </Row>
          <Muted>
            {mech.model} · Revision {mech.revision}
          </Muted>
        </Stack>
        <Row>
          <Button
            disabled={busy}
            onClick={() => setStatus(mech.status === 'active' ? MechStatus.Paused : MechStatus.Active)}
          >
            {mech.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button onClick={() => setEditing(true)}>Edit definition</Button>
          <Button tone="primary" disabled={mech.status === 'archived'} onClick={() => setMessage((value) => !value)}>
            Send message
          </Button>
        </Row>
      </Row>
      {error !== undefined && <Notice error>{error}</Notice>}
      {mech.status === 'paused' && (
        <Notice>
          Paused. New messages wait in the inbox until you activate this mech. A running turn may still finish.
        </Notice>
      )}
      {message && <MessageForm data={data} mech={mech} onClose={() => setMessage(false)} />}
      <Tabs options={['Turns', 'Activity', 'Definition']} value={tab} onChange={setTab} />
      {tab === 'Turns' && <TurnsScreen data={data} mechId={mech.id} onTurn={onTurn} />}
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
  );
}

function TurnsScreen({
  data,
  mechId,
  onTurn,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly onTurn: (id: string) => void;
}): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<Turn['id']>>([]);
  const after = cursors.at(-1);
  const source = useMemo(() => data.turns(mechId, Option.fromNullishOr(after)), [data, mechId, after]);

  return (
    <Resource data={data} source={source}>
      {(page) => (
        <Stack>
          <TurnList page={page} onOpen={onTurn} />
          <Row between>
            <Muted>Newest turns first</Muted>
            <Row>
              <Button disabled={cursors.length === 0} onClick={() => setCursors((previous) => previous.slice(0, -1))}>
                Newer
              </Button>
              <Button
                disabled={!page.hasMore}
                onClick={() => {
                  const last = page.turns.at(-1);

                  if (last !== undefined) {
                    setCursors((previous) => [...previous, last.id]);
                  }
                }}
              >
                Older
              </Button>
            </Row>
          </Row>
        </Stack>
      )}
    </Resource>
  );
}

function ActivityScreen({ data, mechId }: { readonly data: ConsoleData; readonly mechId: string }): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<number>>([]);
  const before = cursors.at(-1) ?? null;
  const source = useMemo(() => data.events(mechId, before), [data, mechId, before]);

  return (
    <Resource data={data} source={source}>
      {(page) => (
        <Stack>
          <Row between>
            <Muted>
              {before === null ? 'Recent activity · updates while this page is visible' : 'Earlier activity'}
            </Muted>
            <Row>
              <Button disabled={cursors.length === 0} onClick={() => setCursors((previous) => previous.slice(0, -1))}>
                Newer
              </Button>
              <Button
                disabled={!page.hasMore}
                onClick={() => {
                  const first = page.events[0];

                  if (first !== undefined) {
                    setCursors((previous) => [...previous, first.sequence]);
                  }
                }}
              >
                Older
              </Button>
            </Row>
          </Row>
          <Activity page={page} />
        </Stack>
      )}
    </Resource>
  );
}

function TraceScreen({
  data,
  mech,
  turnId,
  onBack,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly turnId: string;
  readonly onBack: () => void;
}): ReactNode {
  if (!Schema.is(TurnId)(turnId)) {
    return (
      <Stack>
        <Button onClick={onBack}>← Turns</Button>
        <Notice error>This turn ID is not valid.</Notice>
      </Stack>
    );
  }

  return <ValidTraceScreen data={data} mech={mech} turnId={turnId} onBack={onBack} />;
}

function ValidTraceScreen({
  data,
  mech,
  turnId,
  onBack,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly turnId: Turn['id'];
  readonly onBack: () => void;
}): ReactNode {
  const source = useMemo(() => data.trace(mech.id, turnId), [data, mech.id, turnId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function cancel(): void {
    setBusy(true);
    setError(undefined);
    void data
      .api('cancelTurn', { workspaceId: data.workspace.id, mechId: mech.id, turnId })
      .then(() => source.utils.refetch())
      .then(
        () => setBusy(false),
        (cause: unknown) => {
          setBusy(false);
          setError(problemMessage(cause));
        },
      );
  }

  return (
    <Stack>
      <Row>
        <Button tone="quiet" onClick={onBack}>
          ← {mech.name} / Turns
        </Button>
      </Row>
      <Heading>Turn trace</Heading>
      <Identifier>{turnId}</Identifier>
      {error !== undefined && <Notice error>{error}</Notice>}
      <Resource data={data} source={source}>
        {(trace) => (
          <Stack>
            {trace.turn.status === 'running' && (
              <Row>
                <Notice>This turn is running.</Notice>
                <Button tone="danger" disabled={busy} onClick={cancel}>
                  {busy ? 'Canceling…' : 'Cancel turn'}
                </Button>
              </Row>
            )}
            <TurnTrace trace={trace} />
          </Stack>
        )}
      </Resource>
    </Stack>
  );
}

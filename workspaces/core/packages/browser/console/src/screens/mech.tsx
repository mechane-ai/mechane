import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { moneyLabel } from '@mechane/console-views';
import { MechStatus } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
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
import { Option } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';
import { ActivityScreen } from './activity.tsx';
import { EditMechForm } from './edit-mech.tsx';
import { MessageForm } from './message.tsx';
import { TraceScreen } from './trace.tsx';
import { TurnsScreen } from './turns.tsx';

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
      <Tabs options={['Turns', 'Activity', 'Definition']} value={tab} onChange={setTab}>
        <Stack>
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
      </Tabs>
    </Stack>
  );
}

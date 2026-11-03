import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { TurnTrace } from '@mechane/console-views';
import type { Mech, Turn } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { Button, Heading, Notice, Row, Stack } from '@mechane/ui';
import { Schema } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';
import { TurnHistory } from './turn-history.tsx';

export function TraceScreen({
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
            <TurnTrace key={turnId} trace={trace} />
            <TurnHistory data={data} mechId={mech.id} turnId={turnId} />
          </Stack>
        )}
      </Resource>
    </Stack>
  );
}

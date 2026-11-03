import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { TurnTrace } from '@mechane/console-views';
import type { Mech, Turn } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { Button, DetailPage, Heading, Notice, Row, Stack, Toolbar, ToolbarAction } from '@mechane/ui';
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
  notice,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly turnId: string;
  readonly onBack: () => void;
  readonly notice?: ReactNode;
}): ReactNode {
  if (!Schema.is(TurnId)(turnId)) {
    return (
      <>
        <Toolbar
          breadcrumb
          title={
            <Button tone="link" onClick={onBack}>
              Turns
            </Button>
          }
        />
        {notice}
        <DetailPage>
          <Notice error>This turn ID is not valid.</Notice>
        </DetailPage>
      </>
    );
  }

  return <ValidTraceScreen data={data} mech={mech} notice={notice} turnId={turnId} onBack={onBack} />;
}

function ValidTraceScreen({
  data,
  mech,
  turnId,
  onBack,
  notice,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly turnId: Turn['id'];
  readonly onBack: () => void;
  readonly notice?: ReactNode;
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
    <Resource data={data} source={source} fallbackHeader={<Toolbar title="Turn trace" />}>
      {(trace, traceNotice) => (
        <>
          <Toolbar
            breadcrumb
            title={
              <>
                <Button tone="link" onClick={onBack}>
                  {mech.name} / Turns
                </Button>{' '}
                / Turn trace
              </>
            }
            actions={
              trace.turn.status === 'running' && (
                <ToolbarAction disabled={busy} onClick={cancel}>
                  {busy ? 'Canceling…' : 'Cancel turn'}
                </ToolbarAction>
              )
            }
          />
          {notice}
          {traceNotice}
          <DetailPage>
            <Stack>
              <Heading>Turn trace</Heading>
              {error !== undefined && <Notice error>{error}</Notice>}
              {trace.turn.status === 'running' && (
                <Row>
                  <Notice>This turn is running.</Notice>
                </Row>
              )}
              <TurnTrace key={turnId} trace={trace} />
              <TurnHistory data={data} mechId={mech.id} turnId={turnId} />
            </Stack>
          </DetailPage>
        </>
      )}
    </Resource>
  );
}

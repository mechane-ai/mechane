import { Button, Row, Stack, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { isImportedTurn } from '@mechane/console-views';
import { Turn } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { useTurns } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

const activeStatuses: ReadonlySet<Turn['status']> = new Set(['queued', 'running']);

type StopState = {
  readonly turnId: Turn['id'];
  readonly status: 'sending' | 'received' | 'failed';
  readonly error?: string;
};

export function ConversationActivity({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const state = useTurns(data, data.reads.turns(mech.id, null));
  const [stopState, setStopState] = useState<StopState>();
  const isScreenActive = useScreenLifetime();

  function stop(turnId: Turn['id']): void {
    if (stopState?.turnId === turnId && stopState.status !== 'failed') {
      return;
    }

    setStopState({ turnId, status: 'sending' });
    void data.commands.cancelTurn({ mechId: MechId.make(mech.id), turnId }).then(
      () => {
        if (isScreenActive()) {
          setStopState((current) => (current?.turnId === turnId ? { turnId, status: 'received' } : current));
        }
      },
      (problem: unknown) => {
        if (isScreenActive()) {
          setStopState((current) =>
            current?.turnId === turnId ? { turnId, status: 'failed', error: problemMessage(problem) } : current,
          );
        }
      },
    );
  }

  return (
    <ResourceView
      state={state}
      label="Loading activity"
      placeholder={<SkeletonText width="8ch" />}
      failure={
        <Text variant="caption" tone="muted" role="status">
          Activity unavailable
          {state.kind === 'failed' && (
            <Button variant="ghost" onClick={state.retry}>
              Retry
            </Button>
          )}
        </Text>
      }
    >
      {(page, notice) => {
        const active = page.turns
          .filter(Schema.is(Turn))
          .find((turn) => !isImportedTurn(turn) && activeStatuses.has(turn.status));

        const currentStop = active?.id === stopState?.turnId ? stopState : undefined;

        return (
          <Stack isCompact>
            {notice}
            {active === undefined ? (
              mech.status === 'paused' ? (
                <Text variant="caption" tone="muted">
                  Paused
                </Text>
              ) : null
            ) : (
              <Row>
                <Text variant="caption" tone="muted" role="status">
                  {currentStop?.status === 'received' ? 'Stopping' : active.status === 'queued' ? 'Ready' : 'Working'}
                </Text>
                <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn: active.id }} row={active.id}>
                  Inspect
                </ConsoleLink>
                <Button
                  variant="ghost"
                  disabled={currentStop?.status === 'received'}
                  isPending={currentStop?.status === 'sending'}
                  pendingLabel="Stopping…"
                  onClick={() => stop(active.id)}
                >
                  Stop
                </Button>
                {currentStop?.status === 'failed' && (
                  <Text variant="caption" role="status">
                    {currentStop.error}
                  </Text>
                )}
              </Row>
            )}
          </Stack>
        );
      }}
    </ResourceView>
  );
}

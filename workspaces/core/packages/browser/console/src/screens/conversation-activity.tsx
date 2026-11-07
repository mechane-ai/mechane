import { Button, Row, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import type { Mech } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { useTrace } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function ConversationActivity({
  data,
  mech,
  runId,
  sessionId,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly runId: string | null;
  readonly sessionId: string;
}): ReactNode {
  const request = runId === null ? undefined : data.reads.trace(mech.id, TurnId.make(runId));
  const state = useTrace(data, request);

  if (runId === null) {
    return mech.status === 'paused' ? (
      <Text variant="caption" tone="muted">
        Paused
      </Text>
    ) : null;
  }

  return (
    <Row>
      <ResourceView
        state={state}
        label="Loading run status"
        placeholder={<SkeletonText width="8ch" />}
        failure={
          <Text variant="caption" tone="muted" role="status">
            Run status unavailable
            {state.kind === 'failed' && (
              <Button variant="ghost" onClick={state.retry}>
                Retry
              </Button>
            )}
          </Text>
        }
      >
        {(trace) => (
          <Text variant="caption" tone="muted" role="status">
            {trace.turn.status === 'queued' && 'Queued'}
            {trace.turn.status === 'running' && 'Working'}
            {trace.turn.status === 'waiting' && 'Waiting for approval'}
            {trace.turn.status === 'answered' && 'Finished'}
            {trace.turn.status === 'unanswered' && 'Run ended without a reply'}
          </Text>
        )}
      </ResourceView>
      <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, session: sessionId, turn: runId }} row={runId}>
        Open run
      </ConsoleLink>
    </Row>
  );
}

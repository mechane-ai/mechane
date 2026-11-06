import { Button, Row, Status, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import { decodeTurn, recordKey } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Turn } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { Schema } from 'effect';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useWorkspaceDrafts } from '../drafts.tsx';
import type { MessageRunReceipt } from '../drafts.tsx';
import { ConsoleLink } from '../navigation.tsx';
import { useCanonicalRows, useTrace, useTurns } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function ConversationActivity({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const { message, observeMessageTurn } = useWorkspaceDrafts();
  const { received, outcome } = message;
  const request = data.reads.turns(mech.id, null);
  const state = useTurns(data, request);
  const snapshot = state.kind === 'ready' ? state.value : undefined;
  const turns = snapshot?.turns.filter(Schema.is(Turn)) ?? [];
  const observed = received === undefined ? undefined : turns.find((turn) => turn.inboxItemIds.includes(received.id));
  const recordedId = outcome?.turnId;

  const knownRows = useCanonicalRows(
    data,
    data.collections.turns,
    recordedId === undefined ? undefined : [recordKey(mech.id, recordedId)],
  );

  const knownRow = knownRows.data?.[0];
  const knownTurn = knownRow === undefined ? undefined : decodeTurn(knownRow);
  const recorded = Schema.is(Turn)(knownTurn) ? knownTurn : undefined;
  const traceRequest = recordedId === undefined ? undefined : data.reads.trace(mech.id, recordedId);
  const recoveryRequest = knownRows.isReady && knownRow === undefined ? traceRequest : undefined;
  const recovered = useTrace(data, recoveryRequest);
  const recoveredTurn = recovered.kind === 'ready' ? recovered.value.turn : undefined;

  const shouldRetainRecorded =
    !data.isReadRevoked(request) && (traceRequest === undefined || !data.isReadRevoked(traceRequest));

  const associated = observed ?? recorded ?? (Schema.is(Turn)(recoveredTurn) ? recoveredTurn : undefined);

  const receivedTurn =
    shouldRetainRecorded && associated?.inboxItemIds.includes(received?.id ?? '') === true ? associated : undefined;

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive || received === undefined) {
        return;
      }

      if (!shouldRetainRecorded || receivedTurn !== undefined) {
        observeMessageTurn(received.id, shouldRetainRecorded ? receivedTurn : undefined);
      }
    });

    return () => {
      isActive = false;
    };
  }, [observeMessageTurn, received, receivedTurn, shouldRetainRecorded]);

  const receipt =
    received === undefined ? undefined : <MessageReceipt outcome={shouldRetainRecorded ? outcome : undefined} />;

  const running = turns.find((turn) => turn.status === 'running');
  const latest = snapshot?.turns[0];
  const isUnknown = latest !== undefined && !Schema.is(Turn)(latest);
  const currentId = running?.id ?? receivedTurn?.id ?? (shouldRetainRecorded ? outcome?.turnId : undefined);
  const label = activityLabel(mech, running, isUnknown);
  const hasFailedMessage = shouldRetainRecorded && outcome?.status === 'unanswered';
  const isInspectable = running !== undefined || hasFailedMessage;

  const refreshFailure = state.kind === 'ready' && state.refresh.kind === 'failed' ? state.refresh : undefined;

  const failure =
    state.kind === 'failed' ? (
      <Row>
        <Text variant="caption" tone="muted" role="status">
          Activity unavailable
        </Text>
        <Button variant="ghost" onClick={state.retry} isPending={state.isRetrying} pendingLabel="Retrying activity…">
          Retry activity
        </Button>
      </Row>
    ) : undefined;

  return (
    <Row>
      <ResourceView
        state={state}
        label="Loading activity"
        placeholder={
          <Text variant="caption">
            <SkeletonText width="8ch" />
          </Text>
        }
        failure={failure}
      >
        {() => (
          <Row>
            <Text variant="caption" tone="muted" role="status">
              {refreshFailure === undefined ? label : `Refresh failed · last seen ${label.toLowerCase()}`}
            </Text>
            {isInspectable && currentId !== undefined && (
              <ConsoleLink
                to={{ workspace: data.workspace.id, mech: mech.id, view: 'conversation', turn: currentId }}
                row={currentId}
              >
                Open run
              </ConsoleLink>
            )}
            {refreshFailure !== undefined && (
              <Button
                variant="ghost"
                onClick={refreshFailure.retry}
                isPending={refreshFailure.isRetrying}
                pendingLabel="Retrying activity…"
              >
                Retry activity
              </Button>
            )}
          </Row>
        )}
      </ResourceView>
      {receipt}
    </Row>
  );
}

function MessageReceipt({ outcome }: { readonly outcome: MessageRunReceipt | undefined }): ReactNode {
  if (outcome?.status === 'unanswered') {
    return <Status tone={outcome.wasCanceled ? 'neutral' : 'negative'}>Message run ended without a reply</Status>;
  }

  let label = 'Message received · awaiting run status';

  if (outcome?.status === 'answered') {
    label = 'Reply received';
  } else if (outcome?.status === 'running') {
    label = 'Message accepted by a run';
  }

  return (
    <Text variant="caption" tone="muted" role="status">
      {label}
    </Text>
  );
}

function activityLabel(mech: Mech, running: Turn | undefined, isUnknown: boolean): string {
  if (isUnknown) {
    return 'Activity uses a newer format';
  }

  if (running !== undefined) {
    return 'Running';
  }

  if (mech.status === 'archived') {
    return 'Archived';
  }

  return mech.status === 'paused' ? 'Paused' : 'Idle';
}

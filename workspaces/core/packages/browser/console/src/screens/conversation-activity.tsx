import { Button, Row, Status, Text } from '@mechane-ai/elements';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import type { ConsoleData } from '@mechane/console-data';
import { Turn } from '@mechane/protocol';
import type { InboxItem, Mech } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { ResourceView, useCollectionLifetime, useResource } from '../resource.tsx';

export function ConversationActivity({
  data,
  mech,
  received,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly received: InboxItem | undefined;
}): ReactNode {
  const source = useMemo(() => data.turns(mech.id, Option.none()), [data, mech.id]);

  useCollectionLifetime(data, source);

  const state = useResource(data, source);
  const snapshot = state.kind === 'ready' ? state.value : undefined;
  const turns = snapshot?.turns.filter(Schema.is(Turn)) ?? [];
  const observed = received === undefined ? undefined : turns.find((turn) => turn.inboxItemIds.includes(received.id));
  const [recorded, setRecorded] = useState<Turn>();
  const shouldRetainRecorded = state.kind !== 'failed';

  if (!shouldRetainRecorded && recorded !== undefined) {
    setRecorded(undefined);
  }

  if (observed !== undefined && observed !== recorded) {
    setRecorded(observed);
  }

  const isAssociated =
    shouldRetainRecorded && received !== undefined && recorded?.inboxItemIds.includes(received.id) === true;

  const receivedTurn = observed ?? (isAssociated ? recorded : undefined);
  const receipt = received === undefined ? undefined : <MessageReceipt turn={receivedTurn} />;

  const running = turns.find((turn) => turn.status === 'running');
  const latest = snapshot?.turns[0];
  const isUnknown = latest !== undefined && !Schema.is(Turn)(latest);
  const current = running ?? receivedTurn;
  const label = activityLabel(mech, running, isUnknown);
  const hasFailedMessage = receivedTurn?.status === 'unanswered';
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
        identity={source.id}
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
            {isInspectable && current !== undefined && (
              <ConsoleLink
                to={{ workspace: data.workspace.id, mech: mech.id, view: 'conversation', turn: current.id }}
                row={current.id}
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

function MessageReceipt({ turn }: { readonly turn: Turn | undefined }): ReactNode {
  if (turn?.status === 'unanswered') {
    return (
      <Status tone={turn.reason === 'canceled' ? 'neutral' : 'negative'}>Message run ended without a reply</Status>
    );
  }

  let label = 'Message received · awaiting run status';

  if (turn?.status === 'answered') {
    label = 'Reply received';
  } else if (turn?.status === 'running') {
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

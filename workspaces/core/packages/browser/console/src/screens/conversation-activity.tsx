import { Button, Row, Status, Text } from '@mechane-ai/elements';
import type { ConsoleData } from '@mechane/console-data';
import { Turn } from '@mechane/protocol';
import type { InboxItem, Mech } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { useResource } from '../resource.tsx';

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
  const state = useResource(data, source);
  const snapshot = 'value' in state ? state.value : undefined;
  const turns = snapshot?.turns.filter(Schema.is(Turn)) ?? [];
  const observed = received === undefined ? undefined : turns.find((turn) => turn.inboxItemIds.includes(received.id));
  const [recorded, setRecorded] = useState<Turn>();

  if (observed !== undefined && observed !== recorded) {
    setRecorded(observed);
  }

  const associated = received !== undefined && recorded?.inboxItemIds.includes(received.id) === true;
  const receivedTurn = observed ?? (associated ? recorded : undefined);
  const receipt = received === undefined ? undefined : <MessageReceipt turn={receivedTurn} />;

  if (state.kind === 'pending') {
    return (
      <Row>
        {receipt}
        <Text variant="caption" tone="muted" role="status">
          Checking activity…
        </Text>
      </Row>
    );
  }

  if (state.kind === 'failed') {
    return (
      <Row>
        {receipt}
        <Text variant="caption" tone="muted" role="status">
          Activity unavailable
        </Text>
        <Button variant="ghost" size="sm" onClick={state.retry}>
          Retry activity
        </Button>
      </Row>
    );
  }

  const running = turns.find((turn) => turn.status === 'running');
  const latest = state.value.turns[0];
  const unknown = latest !== undefined && !Schema.is(Turn)(latest);
  const current = running ?? receivedTurn;
  const label = activityLabel(mech, running, unknown);
  const failedMessage = receivedTurn?.status === 'unanswered';
  const inspectable = running !== undefined || failedMessage;

  return (
    <Row>
      <Text variant="caption" tone="muted" role="status">
        {state.kind === 'stale' ? `Refresh failed · last seen ${label.toLowerCase()}` : label}
      </Text>
      {receipt}
      {inspectable && current !== undefined && (
        <ConsoleLink
          to={{ workspace: data.workspace.id, mech: mech.id, view: 'conversation', turn: current.id }}
          row={current.id}
        >
          Open run
        </ConsoleLink>
      )}
      {state.kind === 'stale' && (
        <Button variant="ghost" size="sm" onClick={state.retry}>
          Retry activity
        </Button>
      )}
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

function activityLabel(mech: Mech, running: Turn | undefined, unknown: boolean): string {
  if (unknown) {
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

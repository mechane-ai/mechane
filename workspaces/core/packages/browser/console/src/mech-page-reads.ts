import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { Turn } from '@mechane/protocol';
import { EvidenceArtifactId, TurnId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { useEffect } from 'react';
import { useConversationEntry, useConversationState } from './conversations/provider.tsx';
import { usePageRead } from './page-read.tsx';
import type { PageRead } from './page-read.tsx';
import {
  useEnvironmentProcesses,
  useEvents,
  useEvidenceArtifact,
  useMemories,
  useThreads,
  useTrace,
  useTurns,
} from './reads.ts';
import type { ResourceState } from './resource.tsx';
import type { ConsoleLocation } from './types.ts';

type MechViewRead =
  | { readonly view: 'conversation' | 'definition' }
  | { readonly view: 'runs'; readonly pageRead: PageRead<'turns', ReadRequest<'turns'>> }
  | { readonly view: 'work'; readonly pageRead: PageRead<'work', ReadRequest<'threads'>> }
  | { readonly view: 'memory'; readonly request: ReadRequest<'memories'> }
  | { readonly view: 'environment'; readonly request: ReadRequest<'environmentProcesses'> }
  | { readonly view: 'activity'; readonly pageRead: PageRead<'activity', ReadRequest<'events'>> };

/** Coordinates exact primary readiness while keeping conversation pagination owned across run inspection. */
export function useMechPageReads(data: ConsoleData, mechId: string, location: ConsoleLocation) {
  const requestedView = location.view ?? 'conversation';

  const conversation = useConversationEntry(
    mechId,
    location.session,
    requestedView === 'conversation' && location.turn === undefined && location.artifact === undefined,
  );

  const conversationState = useConversationState(conversation);

  const turns = usePageRead({
    data,
    key: 'turns',
    scope: mechId,
    isEnabled: requestedView === 'runs',
    create: (cursors) => data.reads.turns(mechId, cursors.at(-1) ?? null),
  });

  const work = usePageRead({
    data,
    key: 'work',
    scope: mechId,
    isEnabled: requestedView === 'work',
    create: (cursors) => data.reads.threads(mechId, cursors.at(-1) ?? null),
  });

  const activity = usePageRead({
    data,
    key: 'activity',
    scope: mechId,
    isEnabled: requestedView === 'activity',
    create: (cursors) => data.reads.events(mechId, cursors.at(-1) ?? null),
  });

  const memory = requestedView === 'memory' ? data.reads.memories(mechId) : undefined;
  const environment = requestedView === 'environment' ? data.reads.environmentProcesses(mechId) : undefined;
  const turnId = Schema.decodeUnknownResult(TurnId, { onExcessProperty: 'error' })(location.turn);
  const trace = Result.isSuccess(turnId) ? data.reads.trace(mechId, turnId.success) : undefined;
  const hasFocusedDetail = location.turn !== undefined || location.artifact !== undefined;
  const artifactId = Schema.decodeUnknownResult(EvidenceArtifactId, { onExcessProperty: 'error' })(location.artifact);
  const artifact = Result.isSuccess(artifactId) ? data.reads.evidenceArtifact(mechId, artifactId.success) : undefined;
  const viewRead = readView();

  const currentActivity = viewRead.view === 'conversation' ? data.reads.turns(mechId, null) : undefined;
  const turnsState = useTurns(data, hasFocusedDetail ? undefined : (turns?.request ?? currentActivity));
  const workState = useThreads(data, hasFocusedDetail ? undefined : work?.request);
  const activityState = useEvents(data, hasFocusedDetail ? undefined : activity?.request);
  const memoryState = useMemories(data, hasFocusedDetail ? undefined : memory);
  const environmentState = useEnvironmentProcesses(data, hasFocusedDetail ? undefined : environment);
  const traceState = useTrace(data, location.artifact === undefined ? trace : undefined);
  const evidenceState = useEvidenceArtifact(data, artifact);
  const sessionId = conversationState.kind === 'ready' ? conversationState.value.sessionId : undefined;
  const isConversationOpen = !hasFocusedDetail && viewRead.view === 'conversation';

  const conversationRevision =
    isConversationOpen && turnsState.kind === 'ready' && sessionId !== undefined
      ? JSON.stringify(
          turnsState.value.turns
            .filter(Schema.is(Turn))
            .filter((turn) => turn.sessionId === sessionId)
            .map((turn) => [turn.id, turn.version]),
        )
      : undefined;

  useEffect(() => {
    if (conversationRevision !== undefined) {
      void conversation.refresh();
    }
  }, [conversation, conversationRevision]);

  function readView(): MechViewRead {
    if (turns !== undefined) {
      return { view: 'runs', pageRead: turns };
    }

    if (work !== undefined) {
      return { view: 'work', pageRead: work };
    }

    if (activity !== undefined) {
      return { view: 'activity', pageRead: activity };
    }

    if (memory !== undefined) {
      return { view: 'memory', request: memory };
    }

    if (environment !== undefined) {
      return { view: 'environment', request: environment };
    }

    return { view: requestedView === 'definition' ? 'definition' : 'conversation' };
  }

  function primaryState(): ResourceState<unknown> | undefined {
    if (location.artifact !== undefined) {
      return artifact === undefined ? undefined : evidenceState;
    }

    if (hasFocusedDetail) {
      return trace === undefined ? undefined : traceState;
    }

    switch (viewRead.view) {
      case 'conversation':
        return conversationState;
      case 'runs':
        return turnsState;
      case 'work':
        return workState;
      case 'activity':
        return activityState;
      case 'memory':
        return memoryState;
      case 'environment':
        return environmentState;
      case 'definition':
        return undefined;
    }
  }

  return {
    conversation,
    viewRead,
    trace,
    evidence: artifact === undefined ? undefined : evidenceState,
    primary: primaryState(),
  };
}

/** The current view's read demand and the independent conversation cursor owner. */
export type MechPageReads = ReturnType<typeof useMechPageReads>;

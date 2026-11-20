import { readRequests } from '@mechane/console-data';
import type { ReadRequest } from '@mechane/console-data';
import type { Workspace } from '@mechane/protocol';
import { EvidenceArtifactId, TurnId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { turnEventCursor } from './navigation.tsx';
import { sessionEvidenceRead } from './session-evidence-read.ts';
import type { ConsoleLocation, PageCursors } from './types.ts';

/** Starts the route's heading, primary content, and independent activity demand while local storage opens. */
export function initialReads(
  location: ConsoleLocation,
  pages: Partial<PageCursors> | undefined,
  { role, selection = 'all' }: { readonly role: Workspace['role']; readonly selection?: 'primary' | 'all' },
): ReadonlyArray<ReadRequest> {
  if (location.isArchiveIndex === true) {
    return [];
  }

  if (location.agent !== undefined) {
    const agent = readRequests.agent(location.agent);

    if (location.session === undefined) {
      return [agent, readRequests.sessions(location.agent, location.page ?? null, location)];
    }

    const session = readRequests.session(location.agent, location.session);

    if (location.isSessionEvidence === true) {
      const capture = sessionEvidenceRead({ agentId: location.agent, sessionId: location.session }, location);

      return capture === undefined ? [agent, session] : [agent, session, capture];
    }

    return [
      agent,
      session,
      readRequests.threads(location.agent, location.session),
      readRequests.sessionEvents(
        { agentId: location.agent, sessionId: location.session, threadId: location.thread ?? null },
        location.page ?? null,
        location.through,
      ),
    ];
  }

  const mechId = location.mech;

  if (mechId === undefined) {
    return location.view === 'definition' ? [] : [readRequests.agents(location.page ?? null, location)];
  }

  if (role !== 'owner') {
    return [];
  }

  const heading = readRequests.mech(mechId);

  if (location.artifact !== undefined) {
    const artifactId = Schema.decodeUnknownResult(EvidenceArtifactId, { onExcessProperty: 'error' })(location.artifact);

    return Result.isSuccess(artifactId)
      ? [heading, readRequests.evidenceArtifact(mechId, artifactId.success)]
      : [heading];
  }

  const turnId = location.turn;

  if (turnId !== undefined) {
    const decodedTurnId = Schema.decodeUnknownResult(TurnId, { onExcessProperty: 'error' })(turnId);

    if (Result.isFailure(decodedTurnId)) {
      return [heading];
    }

    const primary: Array<ReadRequest> = [heading, readRequests.trace(mechId, decodedTurnId.success)];
    const inspect = location.inspect ?? location.view;

    if (inspect === 'events') {
      const after = turnEventCursor(pages?.events, location.event);

      primary.push(readRequests.turnEvents(mechId, decodedTurnId.success, after));
    }

    return selection === 'primary'
      ? primary
      : [...primary, readRequests.evidence(mechId, decodedTurnId.success, pages?.evidence?.at(-1) ?? null)];
  }

  const view = location.view ?? 'runs';

  if (view === 'conversation') {
    return [heading, readRequests.archive(mechId, pages?.archive?.at(-1) ?? null)];
  }

  if (view === 'environment') {
    return [heading, readRequests.environment(mechId)];
  }

  if (view === 'activity') {
    return [heading, readRequests.events(mechId, pages?.activity?.at(-1) ?? null)];
  }

  return [heading, readRequests.turns(mechId, pages?.turns?.at(-1) ?? null, location)];
}

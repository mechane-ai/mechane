import { readRequests } from '@mechane/console-data';
import type { ReadRequest } from '@mechane/console-data';
import { EvidenceArtifactId, TurnId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { turnEventCursor } from './navigation.tsx';
import type { ConsoleLocation, PageCursors } from './types.ts';

/** Starts the route's heading, primary content, and independent activity demand while local storage opens. */
export function initialReads(
  location: ConsoleLocation,
  pages: Partial<PageCursors> | undefined,
  selection: 'primary' | 'all' = 'all',
): ReadonlyArray<ReadRequest> {
  const mechId = location.mech;

  if (mechId === undefined) {
    return location.view === 'definition' ? [] : [readRequests.mechs(pages?.mechs?.at(-1) ?? null)];
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

  const view = location.view ?? 'conversation';

  switch (view) {
    case 'runs':
      return [heading, readRequests.turns(mechId, pages?.turns?.at(-1) ?? null)];
    case 'environment':
      return [heading, readRequests.environment(mechId)];
    case 'activity':
      return [heading, readRequests.events(mechId, pages?.activity?.at(-1) ?? null)];
    case 'definition':
      return [heading];
    case 'conversation':
    case 'events':
    case 'requests':
    case 'tools': {
      const primary = [heading];

      return selection === 'primary' ? primary : [...primary, readRequests.turns(mechId, null)];
    }
  }
}

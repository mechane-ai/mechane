import { readRequests } from '@mechane/console-data';
import type { ReadRequest } from '@mechane/console-data';
import { TurnId } from '@mechane/records';
import { Schema } from 'effect';
import type { ConsoleLocation, PageCursors } from './types.ts';

/** Starts the route's heading and primary page demand while local storage opens. */
export function initialReads(
  location: ConsoleLocation,
  pages: Partial<PageCursors> | undefined,
): ReadonlyArray<ReadRequest> {
  const mechId = location.mech;

  if (mechId === undefined) {
    return location.view === 'definition' ? [] : [readRequests.mechs(pages?.mechs?.at(-1) ?? null)];
  }

  const heading = readRequests.mech(mechId);
  const turnId = location.turn;

  if (turnId !== undefined) {
    return Schema.is(TurnId)(turnId) ? [heading, readRequests.trace(mechId, turnId)] : [heading];
  }

  const view = location.view ?? 'conversation';

  switch (view) {
    case 'runs':
      return [heading, readRequests.turns(mechId, pages?.turns?.at(-1) ?? null)];
    case 'work':
      return [heading, readRequests.threads(mechId, pages?.work?.at(-1) ?? null)];
    case 'memory':
      return [heading, readRequests.memories(mechId)];
    case 'activity':
      return [heading, readRequests.events(mechId, pages?.activity?.at(-1) ?? null)];
    case 'definition':
      return [heading];
    case 'conversation':
    case 'events':
    case 'requests':
    case 'tools':
      return [heading, readRequests.events(mechId, pages?.conversation?.at(-1) ?? null)];
  }
}

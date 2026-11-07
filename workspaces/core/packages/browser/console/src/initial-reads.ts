import { readRequests } from '@mechane/console-data';
import type { ReadRequest } from '@mechane/console-data';
import { TurnId } from '@mechane/records';
import { Schema } from 'effect';
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
  const turnId = location.turn;

  if (turnId !== undefined) {
    if (!Schema.is(TurnId)(turnId)) {
      return [heading];
    }

    const primary: Array<ReadRequest> = [heading, readRequests.trace(mechId, turnId)];
    const inspect = location.inspect ?? location.view;

    if (inspect === 'events') {
      const after = turnEventCursor(pages?.events, location.event);

      primary.push(readRequests.turnEvents(mechId, turnId, after));
    }

    return primary;
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
    case 'tools': {
      const primary = [heading];

      return selection === 'primary' ? primary : [...primary, readRequests.turns(mechId, null)];
    }
  }
}

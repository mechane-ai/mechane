import type { EventsAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import { awaitEvents } from './await-events.ts';
import type { AwaitEventsInput } from './types.ts';

/** A page of the mech's events after `after`, waiting for one until the deadline while there are none, or no mech. */
export async function listEvents({
  store,
  signal,
  after,
  deadline,
}: AwaitEventsInput): Promise<typeof EventsAnswer.Encoded> {
  const mech = await store.atomic({ run: (tables) => tables.mech() });

  if (Option.isNone(mech)) {
    return { _tag: 'MechMissing' };
  }

  const { rows, hasMore } = await awaitEvents({ store, signal, after, deadline });

  return { _tag: 'Listed', events: rows, hasMore };
}

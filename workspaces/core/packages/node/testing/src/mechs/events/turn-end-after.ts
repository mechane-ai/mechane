import { EventType } from '@mechane/protocol';
import { Array } from 'effect';
import type { Option } from 'effect';
import type { EventsInput, TurnEndEvent } from './types.ts';

/** The events the follower wrote, and the sequence after which the next turn end comes. */
type TurnEndAfterInput = EventsInput & { readonly last: number };

/** The first turn end after the sequence `last`, none while it has not come. */
export function turnEndAfter({ events, last }: TurnEndAfterInput): Option.Option<TurnEndEvent> {
  return Array.findFirst(
    events.filter((event) => event.sequence > last),
    (event) => event.type === EventType.TurnAnswered || event.type === EventType.TurnUnanswered,
  );
}

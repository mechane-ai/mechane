import { EventType } from '@mechane/protocol';
import type { TurnEndEvent } from './events/types.ts';

type TurnEndInput = { readonly ended: TurnEndEvent };

/** How a turn ended, as a check's detail reports it: its reply, or its reason for none. */
export function turnOutcome({ ended }: TurnEndInput): string {
  switch (ended.type) {
    case EventType.TurnAnswered:
      return `answered ${JSON.stringify(ended.reply)}`;
    case EventType.TurnUnanswered:
      return `unanswered (${ended.reason})`;
  }
}

import type { EntryRecord } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { PiAnswerPart } from './constants.ts';

/** A message of an entry's model context. */
type EntryMessage = NonNullable<EntryRecord['model']>[number];

/** The role of an answer's messages. */
type AnswerRole = { readonly role: typeof PiAnswerPart.Role };

/** A message an answer entry adds to the model's context. */
type AnswerMessage = Extract<EntryMessage, AnswerRole>;

type AssistantMessagesInput = { readonly entry: EntryRecord };

/** The messages an entry adds to the model's context. */
type EntryMessages = NonNullable<EntryRecord['model']>;

/** The messages an entry adds to the model's context as its answer, none for an entry that adds no model message. */
export function assistantMessages({ entry }: AssistantMessagesInput): ReadonlyArray<AnswerMessage> {
  const messages: EntryMessages = Option.getOrElse(Option.fromNullishOr(entry.model), () => []);

  return messages.filter((message) => message.role === PiAnswerPart.Role);
}

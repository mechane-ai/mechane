import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Conversation } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { droneConversationId } from './drone-conversation-id.ts';
import type { DroneInput } from './types.ts';

/** The conversation a drone's document records; only an opened drone is briefed or aborted, so it has one. */
export async function droneConversation({ harness, droneId }: DroneInput): Promise<Conversation> {
  // Only an opened drone is briefed or aborted, and opening it recorded its conversation.
  const conversationId = Option.getOrThrow(await droneConversationId({ harness, droneId }));

  return Option.getOrThrow(Option.fromNullishOr(await harness.conversation(conversationId, BACKGROUND_CONTEXT)));
}

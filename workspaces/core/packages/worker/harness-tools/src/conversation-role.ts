import type { Context } from '@earendil-works/chord';
import { ProviderDoc, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { ConversationId, DocumentReader } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import type { ConversationRole } from './types.ts';

/** A conversation that a tool call or a section rendering reads its role for, and the reads it makes. */
type ConversationRoleInput = {
  readonly read: DocumentReader;
  readonly conversationId: ConversationId;
  readonly context: Context;
};

/**
 * Whom a conversation works for: the root is the mech's own, and every other one is a drone's. A drone's is known by
 * the provider session id it sends, which its drone bound before its first request. No other conversation is ever the
 * mech's.
 */
export async function conversationRole({
  read,
  conversationId,
  context,
}: ConversationRoleInput): Promise<ConversationRole> {
  if (conversationId === ROOT_CONVERSATION_ID) {
    return { _tag: 'Mech' };
  }

  // A drone's conversation holds the provider document its start wrote.
  const provider = Option.getOrThrow(Option.fromNullishOr(await read.snapshot(ProviderDoc, conversationId, context)));

  return { _tag: 'Drone', sessionId: provider.sessionId };
}

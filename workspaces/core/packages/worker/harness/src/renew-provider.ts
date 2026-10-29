import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ProviderDoc, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import type { HarnessHandle } from './types.ts';

/**
 * Gives the mech's conversation a fresh provider session id in one commit, so an upstream that keys its caches by the
 * id never mixes a fork's requests with its parent's. A mech that never took a turn has no conversation yet, and the
 * one pi creates for it gets an id of its own.
 */
export async function renewProvider({ harness }: HarnessHandle): Promise<void> {
  const renew: (transaction: Tx) => Promise<void> = async (transaction) => {
    if (Option.isNone(Option.fromNullishOr(await transaction.conversation(ROOT_CONVERSATION_ID)))) {
      return;
    }

    const provider = await transaction.doc(ProviderDoc, ROOT_CONVERSATION_ID);

    provider.sessionId = crypto.randomUUID();
  };

  await harness.commit(renew, BACKGROUND_CONTEXT);
}

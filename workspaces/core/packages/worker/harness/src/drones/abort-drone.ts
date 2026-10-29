import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { droneConversation } from './drone-conversation.ts';
import type { DroneInput } from './types.ts';

/**
 * Aborts what a drone's conversation runs, withdraws its brief if pi still queues it, and waits until the conversation
 * is idle. Once this returns, pi has ended the brief unanswered.
 */
export async function abortDrone({ harness, droneId }: DroneInput): Promise<void> {
  const conversation = await droneConversation({ harness, droneId });

  await conversation.abort(BACKGROUND_CONTEXT);
}

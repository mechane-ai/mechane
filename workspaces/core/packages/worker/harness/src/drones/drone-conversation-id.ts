import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { DroneDoc } from './drone-doc.ts';
import type { DroneInput } from './types.ts';

/** The conversation a drone's document records, none before the drone's first opening creates it. */
export async function droneConversationId({ harness, droneId }: DroneInput): Promise<Option.Option<ConversationId>> {
  const drone = Option.fromNullishOr(await harness.snapshot(DroneDoc, droneId, BACKGROUND_CONTEXT));

  return Option.flatMapNullishOr(drone, (doc) => doc.conversationId);
}

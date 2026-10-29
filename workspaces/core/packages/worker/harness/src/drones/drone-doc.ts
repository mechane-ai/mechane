import { defineDocFamily } from '@earendil-works/pi-durable';
import type { ConversationId } from '@earendil-works/pi-durable';

/** The kind of the session document that records each drone's conversation by its id; pi stores it. */
const DRONE_DOC_KIND = 'mechane.drone';

/** A drone's document, as pi stores it. */
type DroneConversation = {
  /** The conversation the drone runs in, null until its first opening creates it. */
  readonly conversationId: ConversationId | null;
};

/**
 * Each drone's conversation by the drone's id, in pi's own storage, so the commit that creates the conversation also
 * records it. An opening after a restart then finds the conversation instead of creating another.
 */
export const DroneDoc = defineDocFamily<DroneConversation, null>({
  kind: DRONE_DOC_KIND,
  version: 1,
  scope: 'session',
  family: true,
  initial: () => ({ conversationId: null }),
  checkpointWhen: () => true,
});

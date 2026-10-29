import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import type { DroneBriefing } from '../types.ts';
import { droneConversation } from './drone-conversation.ts';

type DeliverBriefInput = DroneBriefing & { readonly harness: Harness };

/** The entry kind of a drone's brief in its transcript; pi stores it, so it is a stored format. */
const DRONE_BRIEF_ENTRY_KIND = 'mechane.drone_brief';

/** Submits a drone's brief to its conversation under the drone's id as pi's request id, which pi admits once. */
export async function deliverBrief({ harness, droneId, brief }: DeliverBriefInput): Promise<void> {
  const conversation = await droneConversation({ harness, droneId });

  await conversation.submit(
    { type: 'input', requestId: droneId, content: brief, entry: { kind: DRONE_BRIEF_ENTRY_KIND } },
    BACKGROUND_CONTEXT,
  );
}

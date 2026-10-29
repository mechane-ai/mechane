import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { configure, ProviderDoc } from '@earendil-works/pi-durable';
import type { ConversationId, Harness, Tx } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { MODEL_PROVIDER } from '../constants.ts';
import type { DroneOpening, DroneSelection } from '../types.ts';
import { DroneDoc } from './drone-doc.ts';

type OpenDroneInput = DroneOpening & { readonly harness: Harness; readonly selection: DroneSelection };

/**
 * What every drone is told, in place of its mech's instructions. Each sentence restates a promise of a drone, so a
 * change to its sandbox, its memory or its report changes it too.
 */
const DRONE_INSTRUCTIONS = [
  'You are a drone: your mech started you for the one task its brief, the first message, describes.',
  "You have a sandbox of your own, apart from your mech's, and you can read your mech's memory as it was saved when",
  'you started, but you cannot change it or start drones of your own.',
  'Your final reply is your report to your mech: write what it needs to act on, since it sees nothing else you did.',
].join(' ');

/** A drone's conversation to create, with its model and what it leaves out, and the transaction it is created in. */
type CreateDroneConversationInput = Pick<OpenDroneInput, 'modelId' | 'selection'> & { readonly transaction: Tx };

/**
 * Opens a drone's conversation in one commit and answers its provider session id. The first opening creates the
 * conversation and records it in the drone's document, so a later one finds it there.
 */
export async function openDrone({ harness, droneId, modelId, selection }: OpenDroneInput): Promise<string> {
  const open: (transaction: Tx) => Promise<string> = async (transaction) => {
    const drone = await transaction.doc(DroneDoc, droneId, null);

    if (Option.isNone(Option.fromNullishOr(drone.conversationId))) {
      drone.conversationId = await createDroneConversation({ transaction, modelId, selection });
    }

    const provider = await transaction.doc(ProviderDoc, Option.getOrThrow(Option.fromNullishOr(drone.conversationId)));

    return provider.sessionId;
  };

  return await harness.commit(open, BACKGROUND_CONTEXT);
}

/**
 * Creates a drone's conversation and configures it as a drone. It is ownerless, so no turn of the mech waits for it or
 * aborts it, and it leaves out what a drone goes without.
 */
async function createDroneConversation({
  transaction,
  modelId,
  selection,
}: CreateDroneConversationInput): Promise<ConversationId> {
  const conversation = await transaction.createConversation({ ownership: { kind: 'ownerless' } });

  await configure(transaction, conversation.id, {
    model: { provider: MODEL_PROVIDER, modelId },
    instructions: DRONE_INSTRUCTIONS,
    extensions: { remove: [selection.threads] },
    tools: { remove: selection.rootTools },
  });

  return conversation.id;
}

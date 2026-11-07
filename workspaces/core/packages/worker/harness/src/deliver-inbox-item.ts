import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { AgentChange } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { MODEL_PROVIDER } from './constants.ts';
import { createInboxSubmission } from './create-inbox-submission.ts';
import type { DeliverInput, DroneSelection, HarnessHandle } from './types.ts';

type DeliveryInput = DeliverInput & HarnessHandle & { readonly selection: DroneSelection };

/**
 * Submits an inbox item to the mech's one conversation, which the first delivery creates with the mech's agent, under
 * the item's id as pi's request id.
 */
export async function deliverInboxItem({ harness, inboxItem, agent, selection }: DeliveryInput): Promise<void> {
  const conversation = await harness.root(BACKGROUND_CONTEXT);

  const omitted: Pick<AgentChange, 'extensions' | 'tools'> = (() => {
    if (agent.isBounded) {
      return { extensions: { remove: [selection.threads] }, tools: { remove: selection.rootTools } };
    }

    return { extensions: { remove: [] }, tools: { remove: [] } };
  })();

  // root() keeps an existing conversation's agent. The host holds this definition until its turn and drones end.
  await conversation.configure(
    {
      model: { provider: MODEL_PROVIDER, modelId: agent.modelId },
      instructions: Option.getOrNull(agent.instructions),
      ...omitted,
    },
    BACKGROUND_CONTEXT,
  );

  const draft = await createInboxSubmission({ inboxItem });

  await conversation.submit(draft, BACKGROUND_CONTEXT);
}

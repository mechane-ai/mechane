import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { AgentChange, SubmissionDraft } from '@earendil-works/pi-durable';
import { Delivery } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { INBOX_ITEM_ENTRY_KIND, MODEL_PROVIDER } from './constants.ts';
import type { DeliverInput, DroneSelection, HarnessHandle, SubmissionDraftInput } from './types.ts';

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

  await conversation.submit(submissionDraft({ inboxItem }), BACKGROUND_CONTEXT);
}

/**
 * The item as pi's submission, by its delivery. An item for when idle, or an interrupt once its receipt canceled the
 * running turn, waits while the mech is busy and then starts its own turn. One for the next pause steers the running
 * turn at that pause, and a silent one is a person's message the mech's next request reads, which starts nothing.
 */
function submissionDraft({ inboxItem }: SubmissionDraftInput): SubmissionDraft {
  const { id: requestId, text, receivedAt } = inboxItem;
  const entry = { kind: INBOX_ITEM_ENTRY_KIND };

  switch (inboxItem.delivery) {
    case Delivery.WhenIdle:
    case Delivery.Interrupt:
      return { type: 'input', requestId, content: text, whenBusy: 'followUp', entry };
    case Delivery.NextPause:
      return { type: 'input', requestId, content: text, whenBusy: 'steer', entry };
    case Delivery.Silent:
      // A write that carries no model message would never reach the model.
      return {
        type: 'write',
        requestId,
        entry: { ...entry, model: [{ role: 'user', content: text, timestamp: DateTime.toEpochMillis(receivedAt) }] },
      };
  }
}

import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import { settledBudgetSubmission } from './budget-resume.ts';
import { projectManagedCompactions } from './compaction-events.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { processManagedEvent } from './event-log/write.ts';
import type { ExclusiveEffect } from './execution-gate.ts';
import { finishManagedInterrupt, pendingExternalEffect } from './input-turns.ts';
import { nativeInputContent } from './large-native-content.ts';
import { prepareSessionMcp } from './mcp/registry.ts';
import { managedOutcomeConversation, outcomeInput } from './outcomes.ts';
import { ActiveNativeSessions, inputKey, release, Sessions, sessionState, Slot, ThreadInputs } from './scheduler.ts';
import type { createSessionExtensions } from './session-extension.ts';
import { applyQueuedSystemMessages } from './system-message.ts';
import { finishManagedTurn, settleManagedSubmission } from './turn-settlement.ts';

type FocusOwner = {
  readonly harness: Harness;
  readonly extensions: ReturnType<typeof createSessionExtensions>;
  readonly exclusive: ExclusiveEffect;
  readonly readBudgetScope: (id: string) => Promise<boolean>;
};

export async function advanceManagedFocus(owner: FocusOwner, id: string): Promise<boolean> {
  const native = await owner.harness.snapshot(Sessions, id, context);

  if (native === undefined || native.conversation === null) {
    throw new Error('Missing native conversation');
  }

  const boundary = await owner.harness.commit(async (transaction) => {
    const state = await sessionState(transaction, id);

    if (state.interrupt !== null) {
      const effect = await pendingExternalEffect(transaction, state);

      if (effect !== null) {
        if (effect === 'worker') {
          await release(transaction, id);
        }

        return null;
      }
    }

    return {
      physicalId: await managedOutcomeConversation(transaction, state),
      settled: await settledBudgetSubmission(transaction, state.submission),
      revision: state.budgetRevision,
    };
  }, context);

  if (boundary === null) {
    return false;
  }

  const isBudgetReached = boundary.settled !== null && (await owner.readBudgetScope(native.publicSessionId));
  const conversation = await owner.harness.conversation(boundary.physicalId, context);

  if (conversation === undefined) {
    throw new Error('Missing native conversation');
  }

  const projection = await prepareSessionMcp({
    harness: owner.harness,
    state: native,
    runtime: owner.extensions.mcpContext(native),
    exclusive: owner.exclusive,
  });

  owner.extensions.install(native, projection);

  if (native.interrupt !== null && native.submission !== null) {
    await conversation.abort(context);
  }

  return await owner.harness.commit(async (transaction) => {
    const state = await sessionState(transaction, id);
    const slot = await transaction.doc(Slot);

    if (slot.owner !== id || (await managedOutcomeConversation(transaction, state)) !== conversation.id) {
      return true;
    }

    if (state.conversation !== null && !(await projectManagedCompactions(transaction, id, state.conversation))) {
      return true;
    }

    if (state.isArchived || state.mutationId !== null) {
      return false;
    }

    if (state.interrupt !== null && state.submission === null) {
      await finishManagedInterrupt(transaction, id);

      state.interrupt = null;

      await finishManagedTurn(transaction, id, { kind: 'interrupted' });

      return true;
    }

    if (state.submission !== null) {
      return await settleManagedSubmission(transaction, state.submission, {
        sessionId: id,
        conversation,
        boundary,
        isBudgetReached,
      });
    }

    if (state.activeEvent !== null) {
      state.submission = await conversation.submit(transaction, { type: 'continue' });

      return true;
    }

    if (state.pendingHead >= state.pendingTail) {
      await finishManagedTurn(transaction, id);

      return true;
    }

    const queuedInput = await transaction.doc(ThreadInputs, inputKey(id, state.pendingHead), null);
    const described = await sessionEvents(id).describe(transaction, queuedInput.eventId);

    if (described === undefined) {
      throw new Error('The queued input is missing');
    }

    const event = described.event;

    if (event.type === 'system.message') {
      await applyQueuedSystemMessages(transaction, id);

      return true;
    }

    const special = await outcomeInput(transaction, id, event);

    if (special === null) {
      state.pendingHead += 1;

      await finishManagedTurn(transaction, id);

      return true;
    }

    const submission = await conversation.submit(transaction, {
      type: 'input',
      requestId: event.id,
      content: special ?? nativeInputContent(event, described.large),
      whenBusy: 'reject',
    });

    state.pendingHead += 1;
    state.activeEvent = event.id;
    state.activation = crypto.randomUUID();
    state.submission = submission;

    await ActiveNativeSessions.put(transaction, id, id);
    await processManagedEvent(transaction, id, event.id);
    await applyQueuedSystemMessages(transaction, id);

    return false;
  }, context);
}

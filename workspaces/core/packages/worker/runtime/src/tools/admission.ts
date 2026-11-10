import type { Context } from '@earendil-works/chord/context';
import type { TaskId, Tx } from '@earendil-works/pi-durable';
import { LiveDoc } from '@earendil-works/pi-durable';
import { Observations, PendingNotifications, Turns } from '../actor/collections.ts';
import { decodeStored, RunRecord } from '../actor/records.ts';
import { State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';

type ExecutionAdmissionInput = {
  readonly access: ActorAccess;
  readonly generationTaskId: TaskId;
  readonly runId: string;
  readonly transaction?: Tx | undefined;
};

async function currentInTransaction(input: ExecutionAdmissionInput, transaction: Tx): Promise<boolean> {
  const state = await transaction.doc(State);

  if (state.isQuiesced || state.isPolicyPaused || !state.isImportComplete) {
    return false;
  }

  if (state.isEnvironmentCheckpointRequired || (await PendingNotifications.countInTransaction(transaction)) > 0) {
    return false;
  }

  const observed = await Observations.read(transaction, String(input.generationTaskId));
  const turn = await Turns.read(transaction, input.runId);
  const live = await transaction.doc(LiveDoc, input.access.conversation.id);

  if (observed === undefined) {
    return false;
  }

  if (observed.turnId !== input.runId || observed.sequence < state.notificationBaseSequence) {
    return false;
  }

  if (turn === undefined || live.run?.taskId !== input.generationTaskId) {
    return false;
  }

  if (!live.run.inputs.includes(turn.submissionId)) {
    return false;
  }

  const run = decodeStored(RunRecord, turn.value);

  if (run.cancelRequestedAt !== null || run.endedAt !== null) {
    return false;
  }

  return await input.access.withControl(async (store) => {
    const mech = await store.getMech(input.access.scope);
    const policy = await store.getRuntimePolicy(input.access.scope);

    return mech.status === 'active' && policy !== null && !policy.isSuspended;
  });
}

export async function isExecutionCurrent(input: ExecutionAdmissionInput, context: Context): Promise<boolean> {
  if (input.transaction !== undefined) {
    return await currentInTransaction(input, input.transaction);
  }

  return await input.access.harness.commit((transaction) => currentInTransaction(input, transaction), context);
}

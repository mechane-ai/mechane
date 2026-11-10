import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { InboxDoc, LiveDoc } from '@earendil-works/pi-durable';
import { RequestInvalid, TurnEnded } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { toolStore } from '../execution/receipts.ts';
import { appendEvent } from '../notifications/admission.ts';
import { writeCancellationDeferred } from '../output/write-actor-diagnostic.ts';
import { cancelRunExecutions } from '../tools/cancel-executions.ts';
import { withToolOwner } from '../tools/context.ts';
import { readRun } from '../views/projections.ts';
import { Cancellations, PendingCancellations, putCancellation, putTurn, Turns } from './collections.ts';
import { decodeStored, RunRecord } from './records.ts';
import { State } from './state.ts';
import type { ActorAccess } from './types.ts';

async function abortNativeTurn(access: ActorAccess, turnId: string): Promise<void> {
  const turn = await Turns.get(access.harness, turnId);

  if (turn === undefined) {
    throw new Error('The cancellation has no native turn');
  }

  const submission = await access.harness.submission(turn.submissionId, BACKGROUND_CONTEXT);

  await submission?.abort(BACKGROUND_CONTEXT);

  const live = await access.harness.snapshot(LiveDoc, access.conversation.id, BACKGROUND_CONTEXT);

  if (live?.run?.inputs.includes(turn.submissionId) === true) {
    await access.harness.abortTask(live.run.taskId, BACKGROUND_CONTEXT);
  }

  access.harness.resume();
}

export async function abortPendingCancellations(access: ActorAccess): Promise<void> {
  const pending = await access.harness.commit(
    (transaction) => PendingCancellations.allInTransaction(transaction),
    BACKGROUND_CONTEXT,
  );

  for (const turnId of pending) {
    await abortNativeTurn(access, turnId);
  }
}

export async function reconcileCancellations(access: ActorAccess): Promise<void> {
  if (!access.isDefinitionReady()) {
    await access.arm();

    return;
  }

  const pending = await access.harness.commit(
    (transaction) => PendingCancellations.allInTransaction(transaction),
    BACKGROUND_CONTEXT,
  );

  for (const turnId of pending) {
    const receipt = await Cancellations.get(access.harness, turnId);

    if (receipt?.status === 'pending') {
      try {
        await abortNativeTurn(access, receipt.turnId);
        await withToolOwner(
          {
            configuration: access.configuration,
            withStore: async (operation) =>
              await access.withControl((control) => operation(toolStore(access, control))),
          },
          async () => await cancelRunExecutions({ runId: receipt.turnId, workspaceId: access.scope.workspaceId }),
        );

        const isComplete = await access.harness.commit(async (transaction) => {
          const state = await transaction.doc(State);
          const cancellation = await Cancellations.read(transaction, receipt.turnId);

          if (cancellation?.status === 'pending') {
            const turn = await Turns.read(transaction, receipt.turnId);
            const live = await transaction.doc(LiveDoc, access.conversation.id);
            const inbox = await transaction.doc(InboxDoc, access.conversation.id);

            if (turn !== undefined && live.run?.inputs.includes(turn.submissionId) === true) {
              return false;
            }

            if (live.run === undefined && inbox.items.some((pendingInput) => pendingInput.mode !== 'write')) {
              if (state.isQuiesced || state.isPolicyPaused || !state.isImportComplete) {
                return false;
              }

              if (state.isEnvironmentCheckpointRequired) {
                return false;
              }

              await access.conversation.submit(transaction, {
                type: 'continue',
                requestId: `cancel:${receipt.turnId}`,
              });
            }

            await putCancellation(transaction, { ...cancellation, status: 'completed' });
            await appendEvent(transaction, {
              type: 'run.cancel_reconciled',
              runId: receipt.turnId,
              payload: { cancelerId: cancellation.cancelerId },
            });
          }

          return true;
        }, BACKGROUND_CONTEXT);

        if (!isComplete) {
          await access.arm();
        }
      } catch (cause) {
        writeCancellationDeferred({ turnId: receipt.turnId, cause });
        await access.arm();
      }
    }
  }
}

export async function requestRunCancellation(
  access: ActorAccess,
  input: { readonly turnId: string; readonly cancelerId: string },
) {
  const run = await readRun(access, input);

  if (run === null) {
    throw new RequestInvalid({ reason: 'The turn does not exist' });
  }

  if (run.runtimeSource === 'imported' || (run.endedAt !== null && run.cancelRequestedAt === null)) {
    throw new TurnEnded({ turnId: TurnId.make(run.id) });
  }

  await access.arm();

  const result = await access.harness.commit(async (transaction) => {
    const turn = await Turns.read(transaction, input.turnId);

    if (turn === undefined) {
      throw new Error('The cancellation target disappeared');
    }

    const current = decodeStored(RunRecord, turn.value);
    const original = await Cancellations.read(transaction, input.turnId);
    const requestedAt = original?.requestedAt ?? current.cancelRequestedAt ?? new Date().toISOString();
    const cancelerId = original?.cancelerId ?? input.cancelerId;

    if (original === undefined) {
      await putCancellation(transaction, { turnId: input.turnId, cancelerId, requestedAt, status: 'pending' });
    }

    if (current.cancelRequestedAt === null) {
      await putTurn(transaction, { ...turn, value: JSON.stringify({ ...current, cancelRequestedAt: requestedAt }) });
      await appendEvent(transaction, { type: 'run.cancel_requested', runId: current.id, payload: { cancelerId } });
    }

    return { ...current, cancelRequestedAt: requestedAt };
  }, BACKGROUND_CONTEXT);

  await abortNativeTurn(access, input.turnId);
  await access.arm();

  return result;
}

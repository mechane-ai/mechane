import { randomUUID } from 'node:crypto';
import { MAXIMUM_WORKING_CONTEXT_BYTES } from '../../domain.ts';
import type { Run, RunStatus } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoreConflict } from '../errors.ts';
import { createExecutionReceiptStore } from '../execution-receipts.ts';
import { createActivityStore } from '../execution/activity.ts';
import { createExecutionReads } from '../execution/reads.ts';
import { readActivation, saveCheckpoint } from './context.ts';
import type { ActivationCheckpoint } from './context.ts';
import { lockActivation, readMailbox } from './locking.ts';
import { reserveActivation } from './reservation.ts';
import { boundWorkingContext } from './working-context.ts';

type FinishActivation = ActivationCheckpoint & {
  readonly shouldContinue: boolean;
  readonly status?: 'completed' | 'failed' | 'cancelled';
  readonly error?: string | null;
  readonly isEnvironmentCheckpointCommitted?: boolean;
};

type ActivationCompletion = { readonly run: Run; readonly nextRun: Run | null };
const MAXIMUM_RECOVERY_REFERENCES = 12;
const MAXIMUM_RECOVERY_REFERENCE_BYTES = 4096;
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(['completed', 'failed', 'cancelled']);

async function recoveryReferences(context: StoreContext, run: Run): Promise<string> {
  const receipts = await createExecutionReceiptStore(context).listRunExecutions({
    runId: run.id,
    workspaceId: run.workspaceId,
  });

  const references = [];

  for (const receipt of receipts.slice(-MAXIMUM_RECOVERY_REFERENCES).toReversed()) {
    const reference = { executionId: receipt.id, kind: receipt.kind, status: receipt.status };
    const candidate = [...references, reference];

    if (Buffer.byteLength(JSON.stringify(candidate)) > MAXIMUM_RECOVERY_REFERENCE_BYTES) {
      break;
    }

    references.push(reference);
  }

  if (receipts.length === 0) {
    return 'No execution receipts were recorded for this activation.';
  }

  const omitted = receipts.length - references.length;
  let result = `Recent execution receipt references (newest first): ${JSON.stringify(references)}. Use read_tool_result to inspect them; a receipt status alone does not prove the requested outcome.`;

  if (omitted > 0) {
    result += ` ${omitted} additional receipt references were omitted from this bounded context.`;
  }

  return result;
}

export function createActivationCompletionStore(context: StoreContext) {
  return {
    finishActivation: async (input: FinishActivation): Promise<ActivationCompletion> =>
      await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, input.runId);
        const activation = await readActivation(transaction, run.id);

        if (TERMINAL_STATUSES.has(run.status)) {
          if (activation.successor_run_id === null) {
            return { run, nextRun: null };
          }

          return {
            run,
            nextRun: await createExecutionReads(transaction).getRun({ runId: activation.successor_run_id }),
          };
        }

        let status = input.status ?? 'completed';

        if (run.cancelRequestedAt !== null) {
          status = 'cancelled';
        }

        let checkpoint = input;

        if (status !== 'completed') {
          let interruption = `Activation ${run.id} was interrupted.`;

          if (status === 'cancelled') {
            interruption = `The user stopped activation ${run.id}. Do not resume that work without new instructions.`;
          }

          const references = await recoveryReferences(transaction, run);

          checkpoint = {
            ...input,
            modelMessages: boundWorkingContext({
              messages: input.modelMessages,
              maximumBytes: MAXIMUM_WORKING_CONTEXT_BYTES,
              notice: `${interruption} Its stored trace and execution receipts may include effects newer than this working context. Inspect them before repeating writes; interruption is not proof that an effect did not happen. ${references}`,
            }),
          };
        }

        if (run.status !== 'queued') {
          await saveCheckpoint(transaction, run, checkpoint);
        } else if (status !== 'completed') {
          await transaction.client.query(
            'UPDATE mechane.mech_mailboxes SET model_messages=$2 WHERE mech_id=$1 AND active_run_id=$3',
            [run.mechId, JSON.stringify(checkpoint.modelMessages), run.id],
          );
        }

        const mailbox = await readMailbox(transaction, run.mechId);

        if (mailbox.active_run_id !== run.id) {
          throw new StoreConflict('Activation no longer owns the mech');
        }

        let shouldWake = mailbox.received_sequence > mailbox.presented_sequence || input.shouldContinue;

        if (status !== 'completed') {
          const attemptedSequence = Math.max(mailbox.presented_sequence, activation.scheduled_sequence);

          shouldWake = mailbox.received_sequence > attemptedSequence;
        }

        let error: string | null = input.error ?? 'Activation failed';

        if (status !== 'failed') {
          error = null;
        }

        await transaction.client.query(
          `UPDATE mechane.runs SET status=$2,reply=NULL,error=$3,
           failure_reason=CASE WHEN $2='failed' THEN COALESCE(failure_reason,'faulted') ELSE NULL END,
           ended_at=now(),version=version+1 WHERE id=$1`,
          [run.id, status, error],
        );
        await transaction.client.query(
          `UPDATE mechane.mech_mailboxes SET active_run_id=NULL,is_wake_pending=$2,
           is_environment_checkpoint_required=$3,updated_at=now() WHERE mech_id=$1`,
          [run.mechId, shouldWake, input.isEnvironmentCheckpointCommitted !== true],
        );
        await transaction.client.query('UPDATE mechane.sessions SET updated_at=now() WHERE id=$1', [run.sessionId]);

        const finished = await createExecutionReads(transaction).getRun({ runId: run.id });

        if (finished === null) {
          throw new StoreConflict('Finished activation was not found');
        }

        let eventType = 'activation.completed';

        if (status === 'failed') {
          eventType = 'activation.failed';
        } else if (status === 'cancelled') {
          eventType = 'activation.stopped';
        }

        await createActivityStore(transaction).appendActivity({
          id: randomUUID(),
          workspaceId: run.workspaceId,
          mechId: run.mechId,
          runId: run.id,
          type: eventType,
          payload: {
            turnId: run.id,
            notificationIds: finished.notificationIds,
            reason: finished.failureReason ?? 'faulted',
          },
        });

        // Admission and this handoff hold the same mech lock, including the idle decision.
        const nextRun = await reserveActivation(transaction, run);

        await transaction.client.query(
          'UPDATE mechane.activation_checkpoints SET successor_run_id=$2 WHERE run_id=$1',
          [run.id, nextRun?.id ?? null],
        );

        return { run: finished, nextRun };
      }),
  };
}

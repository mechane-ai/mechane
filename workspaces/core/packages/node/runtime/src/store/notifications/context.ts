import type { ModelMessage } from 'ai';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { MAXIMUM_WORKING_CONTEXT_BYTES } from '../../domain.ts';
import type { Run, RunStatus } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoreConflict } from '../errors.ts';
import { createRunLifecycle } from '../execution/lifecycle.ts';
import { decodeModelMessage, normalizeModelMessages } from '../execution/rows.ts';
import { lockActivation, readMailbox } from './locking.ts';
import { decodeNotification, requireSequence } from './rows.ts';

const MAXIMUM_NOTIFICATION_BATCH_COUNT = 32;
export const MAXIMUM_NOTIFICATION_BYTES = 131_072;
const ACTIVE_STATUSES: ReadonlySet<RunStatus> = new Set(['running', 'waiting']);

export type ActivationCheckpoint = {
  readonly runId: string;
  readonly checkpointSequence: number;
  readonly presentedSequence: number;
  readonly modelMessages: ReadonlyArray<ModelMessage>;
  readonly traceMessages: ReadonlyArray<ModelMessage>;
};

const ActivationRow = Schema.Struct({
  start_sequence: Schema.Number,
  scheduled_sequence: Schema.Number,
  checkpoint_sequence: Schema.Number,
  checkpoint_fingerprint: Schema.NullOr(Schema.String),
  successor_run_id: Schema.NullOr(Schema.String),
});

export async function readActivation(context: StoreContext, runId: string) {
  const result = await context.client.query('SELECT * FROM mechane.activation_checkpoints WHERE run_id=$1', [runId]);

  if (result.rows.length === 0) {
    throw new StoreConflict('Run is not a notification activation');
  }

  return Schema.decodeUnknownSync(ActivationRow)(result.rows[0]);
}

export async function saveCheckpoint(context: StoreContext, run: Run, input: ActivationCheckpoint): Promise<void> {
  requireSequence(input.presentedSequence);
  requireSequence(input.checkpointSequence);

  const activation = await readActivation(context, run.id);

  if (input.checkpointSequence < activation.checkpoint_sequence) {
    return;
  }

  const modelMessages = normalizeModelMessages(input.modelMessages);
  const traceMessages = normalizeModelMessages(input.traceMessages);

  const storedTrace = await context.client.query(
    'SELECT count(*)::integer AS count FROM mechane.messages WHERE run_id=$1 AND model_message IS NOT NULL',
    [run.id],
  );

  const { count: recordedMessages } = Schema.decodeUnknownSync(Schema.Struct({ count: Schema.Number }))(
    storedTrace.rows[0],
  );

  if (recordedMessages > traceMessages.length) {
    return;
  }

  if (Buffer.byteLength(JSON.stringify(modelMessages)) > MAXIMUM_WORKING_CONTEXT_BYTES) {
    throw new StoreConflict('Working context exceeds its storage limit');
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ modelMessages, traceMessages, presentedSequence: input.presentedSequence }))
    .digest('hex');

  if (input.checkpointSequence === activation.checkpoint_sequence) {
    if (fingerprint !== activation.checkpoint_fingerprint) {
      throw new StoreConflict('Activation checkpoint identity changed');
    }

    return;
  }

  const mailbox = await readMailbox(context, run.mechId);

  if (mailbox.active_run_id !== run.id || !ACTIVE_STATUSES.has(run.status)) {
    throw new StoreConflict('Activation no longer owns the mech context');
  }

  if (input.presentedSequence < mailbox.presented_sequence || input.presentedSequence > mailbox.received_sequence) {
    throw new StoreConflict('Activation checkpoint moved outside its mailbox');
  }

  await createRunLifecycle(context).saveRunMessages({ runId: run.id, modelMessages: traceMessages });
  await context.client.query(
    `UPDATE mechane.mech_mailboxes SET model_messages=$2,presented_sequence=$3,
     is_wake_pending=(received_sequence>$3),updated_at=now() WHERE mech_id=$1`,
    [run.mechId, JSON.stringify(modelMessages), input.presentedSequence],
  );
  await context.client.query(
    `UPDATE mechane.activation_checkpoints SET checkpoint_sequence=$2,checkpoint_fingerprint=$3 WHERE run_id=$1`,
    [run.id, input.checkpointSequence, fingerprint],
  );
  await context.client.query(
    `UPDATE mechane.runs AS run SET notification_ids=ARRAY(
       SELECT notification.id FROM mechane.notifications notification WHERE notification.mech_id=$2
         AND (notification.id=ANY(run.notification_ids) OR
           (notification.received_sequence>$3 AND notification.received_sequence<=$4))
       ORDER BY notification.received_sequence),version=version+1 WHERE run.id=$1`,
    [run.id, run.mechId, activation.start_sequence, input.presentedSequence],
  );
}

export function createActivationContextStore(context: StoreContext) {
  return {
    getMechContext: async ({ runId }: { readonly runId: string }) =>
      await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, runId);
        const mailbox = await readMailbox(transaction, run.mechId);
        const activation = await readActivation(transaction, run.id);

        if (mailbox.active_run_id !== run.id) {
          throw new StoreConflict('Activation no longer owns the mech context');
        }

        return {
          modelMessages: mailbox.model_messages.map(decodeModelMessage),
          presentedSequence: mailbox.presented_sequence,
          checkpointSequence: activation.checkpoint_sequence,
          isEnvironmentCheckpointRequired: mailbox.is_environment_checkpoint_required,
        };
      }),
    drainNotifications: async ({
      runId,
      afterSequence,
    }: {
      readonly runId: string;
      readonly afterSequence: number;
    }) => {
      requireSequence(afterSequence);

      return await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, runId);
        const mailbox = await readMailbox(transaction, run.mechId);

        if (mailbox.active_run_id !== run.id || run.status !== 'running' || run.cancelRequestedAt !== null) {
          throw new StoreConflict('Activation is not accepting notifications');
        }

        const result = await transaction.client.query(
          `SELECT * FROM mechane.notifications WHERE mech_id=$1 AND received_sequence>$2
           ORDER BY received_sequence LIMIT $3`,
          [run.mechId, afterSequence, MAXIMUM_NOTIFICATION_BATCH_COUNT],
        );

        const notifications = [];
        let sizeBytes = 0;
        let presentedSequence = afterSequence;

        for (const row of result.rows) {
          const notification = decodeNotification(row);
          const nextBytes = Buffer.byteLength(JSON.stringify(notification));

          if (notifications.length > 0 && sizeBytes + nextBytes > MAXIMUM_NOTIFICATION_BYTES) {
            break;
          }

          notifications.push(notification);

          sizeBytes += nextBytes;
          presentedSequence = notification.receivedSequence;
        }

        return { notifications, presentedSequence };
      });
    },
    saveActivationCheckpoint: async (input: ActivationCheckpoint): Promise<void> =>
      await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, input.runId);

        await saveCheckpoint(transaction, run, input);
      }),
  };
}

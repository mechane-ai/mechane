import type { ModelMessage, UIMessage } from 'ai';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { MAXIMUM_WORKING_CONTEXT_BYTES } from '../../domain.ts';
import type { Run, RunStatus } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { RecordNotFound, StoreConflict } from '../errors.ts';
import { boundWorkingContext } from '../notifications/working-context.ts';
import { createActivityStore } from './activity.ts';
import { createExecutionReads } from './reads.ts';
import { decodeModelMessage, decodeUiMessages, normalizeModelMessages } from './rows.ts';

type RunIdentity = { readonly runId: string; readonly workspaceId?: string };
type ClaimRunInput = RunIdentity;
type AttachWorkflowInput = { readonly runId: string; readonly workflowId: string };
type CancelRunInput = RunIdentity & { readonly cancelerId?: string };

type SaveRunMessagesInput = {
  readonly runId: string;
  readonly modelMessages: ReadonlyArray<ModelMessage>;
  readonly uiMessages?: ReadonlyArray<UIMessage>;
};

type SuppliedMessages = {
  readonly modelMessages?: ReadonlyArray<ModelMessage>;
  readonly uiMessages?: ReadonlyArray<UIMessage>;
};

type MessageRow = {
  readonly id: string;
  readonly position: number;
  readonly model_message: ModelMessage | null;
  readonly ui_message: UIMessage | null;
};

const ClaimStateSchema = Schema.Struct({ status: Schema.String, is_suspended: Schema.Boolean });
const WorkflowSchema = Schema.Struct({ workflow_id: Schema.NullOr(Schema.String) });
const IdentifierSchema = Schema.Struct({ id: Schema.String });
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(['completed', 'failed', 'cancelled']);
const ACTIVE_STATUSES: ReadonlySet<RunStatus> = new Set(['running', 'waiting']);

async function lockRun(context: StoreContext, { runId, workspaceId }: RunIdentity): Promise<Run> {
  const locked = await context.client.query(
    `
    SELECT m.id FROM mechane.mechs m JOIN mechane.runs r ON r.mech_id=m.id
    WHERE r.id=$1 AND ($2::uuid IS NULL OR r.workspace_id=$2) FOR UPDATE OF m`,
    [runId, workspaceId ?? null],
  );

  if (locked.rows.length === 0) {
    throw new RecordNotFound('Run was not found');
  }

  const run = await createExecutionReads(context).getRun({ runId });

  if (run === null) {
    throw new RecordNotFound('Run was not found');
  }

  return run;
}

async function messageRows(input: SuppliedMessages): Promise<ReadonlyArray<MessageRow>> {
  const modelMessages = normalizeModelMessages(input.modelMessages ?? []);
  const uiMessages = await decodeUiMessages(input.uiMessages ?? []);
  const count = Math.max(modelMessages.length, uiMessages.length);

  return Array.from({ length: count }, (_, position) => ({
    id: randomUUID(),
    position,
    model_message: modelMessages[position] ?? null,
    ui_message: uiMessages[position] ?? null,
  }));
}

async function persistMessages(context: StoreContext, run: Run, messages: ReadonlyArray<MessageRow>): Promise<void> {
  const saved = await context.client.query(
    `
    INSERT INTO mechane.messages(id,session_id,run_id,position,model_message,ui_message)
    SELECT entries.id,$1,$2,entries.position,entries.model_message,entries.ui_message
    FROM jsonb_to_recordset($3::jsonb) AS entries(id uuid,position integer,model_message jsonb,ui_message jsonb)
    ON CONFLICT(run_id,position) DO UPDATE SET
      model_message=COALESCE(mechane.messages.model_message,excluded.model_message),
      ui_message=COALESCE(mechane.messages.ui_message,excluded.ui_message)
    WHERE (mechane.messages.model_message IS NULL OR excluded.model_message IS NULL OR mechane.messages.model_message=excluded.model_message)
      AND (mechane.messages.ui_message IS NULL OR excluded.ui_message IS NULL OR mechane.messages.ui_message=excluded.ui_message)
    RETURNING position`,
    [run.sessionId, run.id, JSON.stringify(messages)],
  );

  if (saved.rows.length !== messages.length) {
    throw new StoreConflict('Recorded run messages changed');
  }
}

async function appendStoppedEvent(context: StoreContext, run: Run): Promise<void> {
  let type = 'turn.unanswered';

  if (run.origin.kind === 'notification') {
    type = 'activation.stopped';
  }

  await createActivityStore(context).appendActivity({
    id: randomUUID(),
    workspaceId: run.workspaceId,
    mechId: run.mechId,
    runId: run.id,
    type,
    payload: { turnId: run.id, notificationIds: run.notificationIds, reason: 'canceled' },
  });
}

async function releaseStoppedActivation(context: StoreContext, run: Run): Promise<void> {
  const found = await context.client.query(
    `SELECT mailbox.model_messages,activation.scheduled_sequence FROM mechane.mech_mailboxes mailbox
     JOIN mechane.activation_checkpoints activation ON activation.run_id=mailbox.active_run_id
     WHERE mailbox.active_run_id=$1`,
    [run.id],
  );

  if (found.rows.length === 0) {
    return;
  }

  const row = Schema.decodeUnknownSync(
    Schema.Struct({ model_messages: Schema.Array(Schema.Unknown), scheduled_sequence: Schema.Number }),
  )(found.rows[0]);

  const messages = boundWorkingContext({
    messages: row.model_messages.map(decodeModelMessage),
    maximumBytes: MAXIMUM_WORKING_CONTEXT_BYTES,
    notice: `The user stopped activation ${run.id} and its scheduled work through notification sequence ${row.scheduled_sequence}. Earlier unread notifications are retained context, not renewed requests. A later notification may provide new instructions; do not resume the stopped work merely because it is still in the inbox.`,
  });

  await context.client.query(
    `UPDATE mechane.mech_mailboxes mailbox SET active_run_id=NULL,model_messages=$3,
     is_wake_pending=mailbox.received_sequence>GREATEST(mailbox.presented_sequence,activation.scheduled_sequence),
     is_environment_checkpoint_required=mailbox.is_environment_checkpoint_required OR $2,updated_at=now()
     FROM mechane.activation_checkpoints activation WHERE activation.run_id=$1 AND mailbox.active_run_id=$1`,
    [run.id, run.status !== 'queued', JSON.stringify(messages)],
  );
}

async function cancelLockedRun(context: StoreContext, run: Run): Promise<Run> {
  await context.client.query(
    `UPDATE mechane.runs SET status='cancelled',reply=NULL,error=NULL,failure_reason=NULL,ended_at=now(),version=version+1 WHERE id=$1`,
    [run.id],
  );
  await appendStoppedEvent(context, run);
  await releaseStoppedActivation(context, run);

  const cancelled = await createExecutionReads(context).getRun({ runId: run.id });

  if (cancelled === null) {
    throw new StoreConflict('Cancelled run was not found');
  }

  return cancelled;
}

export function createRunLifecycle(context: StoreContext) {
  return {
    attachWorkflow: async ({ runId, workflowId }: AttachWorkflowInput): Promise<void> => {
      const attached = await context.client.query(
        `
        UPDATE mechane.runs SET workflow_id=$2,version=version+1 WHERE id=$1 AND workflow_id IS NULL
        RETURNING workflow_id`,
        [runId, workflowId],
      );

      if (attached.rows.length === 0) {
        const existing = await context.client.query('SELECT workflow_id FROM mechane.runs WHERE id=$1', [runId]);

        if (existing.rows.length === 0) {
          throw new RecordNotFound('Run was not found');
        }

        const current = Schema.decodeUnknownSync(WorkflowSchema)(existing.rows[0]);

        if (current.workflow_id !== workflowId) {
          throw new StoreConflict('Run workflow identity changed');
        }

        return;
      }

      Schema.decodeUnknownSync(WorkflowSchema)(attached.rows[0]);
    },
    claimRun: async (input: ClaimRunInput): Promise<'running' | 'queued' | 'terminal'> =>
      await context.atomic(async (transaction) => {
        const run = await lockRun(transaction, input);

        if (TERMINAL_STATUSES.has(run.status)) {
          return 'terminal';
        }

        if (run.cancelRequestedAt !== null) {
          await cancelLockedRun(transaction, run);

          return 'terminal';
        }

        if (ACTIVE_STATUSES.has(run.status)) {
          return 'running';
        }

        const states = await transaction.client.query(
          `
          SELECT m.status,COALESCE((w.policy->>'isSuspended')::boolean,false) AS is_suspended
          FROM mechane.mechs m JOIN mechane.workspaces w ON w.id=m.workspace_id WHERE m.id=$1`,
          [run.mechId],
        );

        const state = Schema.decodeUnknownSync(ClaimStateSchema)(states.rows[0]);

        if (state.status !== 'active' || state.is_suspended) {
          return 'queued';
        }

        const active = await transaction.client.query(
          `
          SELECT id FROM mechane.runs WHERE mech_id=$1 AND status IN ('running','waiting') LIMIT 1`,
          [run.mechId],
        );

        if (active.rows.length > 0) {
          return 'queued';
        }

        const first = await transaction.client.query(
          `
          SELECT id FROM mechane.runs WHERE mech_id=$1 AND status='queued' ORDER BY created_at,id LIMIT 1`,
          [run.mechId],
        );

        const firstRun = Schema.decodeUnknownSync(IdentifierSchema)(first.rows[0]);

        if (firstRun.id !== run.id) {
          return 'queued';
        }

        await transaction.client.query(
          `
          UPDATE mechane.runs SET status='running',started_at=COALESCE(started_at,now()),version=version+1 WHERE id=$1`,
          [run.id],
        );

        let eventType = 'turn.started';
        let eventPayload: Readonly<Record<string, unknown>> = { turnId: run.id, inboxItemIds: [run.inputId] };

        if (run.origin.kind === 'notification') {
          eventType = 'activation.started';
          eventPayload = { turnId: run.id, notificationIds: run.notificationIds };
        }

        await createActivityStore(transaction).appendActivity({
          id: randomUUID(),
          workspaceId: run.workspaceId,
          mechId: run.mechId,
          runId: run.id,
          type: eventType,
          payload: eventPayload,
        });

        return 'running';
      }),
    saveRunMessages: async (input: SaveRunMessagesInput): Promise<void> => {
      const messages = await messageRows(input);

      await context.atomic(async (transaction) => {
        const run = await lockRun(transaction, { runId: input.runId });

        if (TERMINAL_STATUSES.has(run.status)) {
          return;
        }

        if (run.status === 'queued') {
          throw new StoreConflict('Queued runs cannot record model work');
        }

        await persistMessages(transaction, run, messages);
      });
    },
    cancelRun: async (input: CancelRunInput): Promise<Run> =>
      await context.atomic(async (transaction) => {
        const run = await lockRun(transaction, input);

        if (TERMINAL_STATUSES.has(run.status) || run.cancelRequestedAt !== null) {
          return run;
        }

        await transaction.client.query(
          `
          UPDATE mechane.runs SET cancel_requested_at=now(),version=version+1,
            status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,
            ended_at=CASE WHEN status='queued' THEN now() ELSE ended_at END
          WHERE id=$1`,
          [run.id],
        );

        if (input.cancelerId !== undefined) {
          await createActivityStore(transaction).appendActivity({
            id: randomUUID(),
            workspaceId: run.workspaceId,
            mechId: run.mechId,
            runId: run.id,
            type: 'turn.canceled',
            payload: { turnId: run.id, cancelerId: input.cancelerId },
          });
        }

        if (run.status === 'queued') {
          await appendStoppedEvent(transaction, run);
          await releaseStoppedActivation(transaction, run);
        }

        const cancelled = await createExecutionReads(transaction).getRun({ runId: run.id });

        if (cancelled === null) {
          throw new StoreConflict('Cancelled run was not found');
        }

        return cancelled;
      }),
  };
}

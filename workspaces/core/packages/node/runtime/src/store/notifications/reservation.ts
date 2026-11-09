import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { Run, RunStatus } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoreConflict } from '../errors.ts';
import { createExecutionReads } from '../execution/reads.ts';
import { decodeModelMessage } from '../execution/rows.ts';
import { lockMech, readMailbox } from './locking.ts';
import type { MechScope } from './locking.ts';
import { decodeNotification } from './rows.ts';
import { boundWorkingContext } from './working-context.ts';

const Identifier = Schema.Struct({ id: Schema.String });
const MAXIMUM_IMPORTED_CONTEXT_BYTES = 131_072;
const MAXIMUM_IMPORTED_MESSAGES = 512;
const DEFAULT_PENDING_MECHS = 100;
const MAXIMUM_PENDING_MECHS = 1000;
const UNFINISHED_STATUSES: ReadonlySet<RunStatus> = new Set(['queued', 'running', 'waiting']);

async function initializeContext(context: StoreContext, scope: MechScope): Promise<void> {
  const mailbox = await readMailbox(context, scope.mechId);

  if (mailbox.is_context_initialized) {
    return;
  }

  const history = await context.client.query(
    `SELECT message.model_message FROM mechane.messages message JOIN mechane.runs run ON run.id=message.run_id
     WHERE run.mech_id=$1 AND run.status IN ('completed','failed','cancelled') AND message.model_message IS NOT NULL
     ORDER BY run.created_at DESC,run.id DESC,message.position DESC LIMIT $2`,
    [scope.mechId, MAXIMUM_IMPORTED_MESSAGES + 1],
  );

  const importedMessages = history.rows
    .slice(0, MAXIMUM_IMPORTED_MESSAGES)
    .toReversed()
    .map((row: unknown) => {
      const value = Schema.decodeUnknownSync(Schema.Struct({ model_message: Schema.Unknown }))(row);

      return decodeModelMessage(value.model_message);
    });

  const modelMessages = boundWorkingContext({
    messages: importedMessages,
    maximumBytes: MAXIMUM_IMPORTED_CONTEXT_BYTES,
    wasLimited: history.rows.length > MAXIMUM_IMPORTED_MESSAGES,
  });

  const session = await context.client.query(
    `INSERT INTO mechane.sessions(id,workspace_id,mech_id,channel_key,source,title)
     VALUES($1,$2,$3,'mech-context','api','Mech context')
     ON CONFLICT(workspace_id,mech_id,channel_key) DO UPDATE SET channel_key=excluded.channel_key RETURNING id`,
    [randomUUID(), scope.workspaceId, scope.mechId],
  );

  const { id: sessionId } = Schema.decodeUnknownSync(Identifier)(session.rows[0]);

  await context.client.query(
    `UPDATE mechane.mech_mailboxes SET model_messages=$2,session_id=$3,is_context_initialized=true,updated_at=now()
     WHERE mech_id=$1`,
    [scope.mechId, JSON.stringify(modelMessages), sessionId],
  );
}

export async function reserveActivation(context: StoreContext, scope: MechScope): Promise<Run | null> {
  const state = await lockMech(context, scope);
  let mailbox = await readMailbox(context, scope.mechId);

  if (mailbox.active_run_id !== null) {
    const active = await createExecutionReads(context).getRun({ runId: mailbox.active_run_id });

    if (active !== null && UNFINISHED_STATUSES.has(active.status)) {
      return active;
    }

    await context.client.query('UPDATE mechane.mech_mailboxes SET active_run_id=NULL WHERE mech_id=$1', [scope.mechId]);
  }

  if (!mailbox.is_wake_pending || state.status !== 'active' || state.is_suspended) {
    return null;
  }

  const unfinished = await context.client.query(
    `SELECT id FROM mechane.runs WHERE mech_id=$1 AND status IN ('queued','running','waiting') LIMIT 1`,
    [scope.mechId],
  );

  // A prior deployment owns these Workflow histories until it has finished them.
  if (unfinished.rows.length > 0) {
    return null;
  }

  await initializeContext(context, scope);

  mailbox = await readMailbox(context, scope.mechId);

  if (mailbox.session_id === null) {
    throw new StoreConflict('Mech context was not initialized');
  }

  const pending = await context.client.query(
    'SELECT * FROM mechane.notifications WHERE mech_id=$1 AND received_sequence>$2 ORDER BY received_sequence LIMIT 1',
    [scope.mechId, mailbox.presented_sequence],
  );

  const notification = pending.rows.map(decodeNotification)[0] ?? null;
  const runId = randomUUID();
  const inputId = randomUUID();
  const inputText = notification?.text ?? 'Continue working';
  const inputMessage = { id: inputId, role: 'user', parts: [{ type: 'text', text: inputText }] };

  await context.client.query(
    `INSERT INTO mechane.inputs(id,workspace_id,mech_id,session_id,idempotency_key,input_text,input_message,origin)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      inputId,
      scope.workspaceId,
      scope.mechId,
      mailbox.session_id,
      `activation:${runId}`,
      inputText,
      inputMessage,
      { kind: 'notification', notificationId: notification?.id ?? null },
    ],
  );
  await context.client.query(
    `INSERT INTO mechane.runs(id,workspace_id,mech_id,session_id,input_id,definition_revision,status,notification_ids)
     VALUES($1,$2,$3,$4,$5,$6,'queued',ARRAY(
       SELECT id FROM mechane.notifications WHERE mech_id=$3 AND received_sequence>$7 AND received_sequence<=$8
       ORDER BY received_sequence))`,
    [
      runId,
      scope.workspaceId,
      scope.mechId,
      mailbox.session_id,
      inputId,
      state.revision,
      mailbox.presented_sequence,
      mailbox.received_sequence,
    ],
  );
  await context.client.query(
    `INSERT INTO mechane.activation_checkpoints(run_id,start_sequence,scheduled_sequence) VALUES($1,$2,$3)`,
    [runId, mailbox.presented_sequence, mailbox.received_sequence],
  );
  await context.client.query('UPDATE mechane.mech_mailboxes SET active_run_id=$2,updated_at=now() WHERE mech_id=$1', [
    scope.mechId,
    runId,
  ]);

  return await createExecutionReads(context).getRun({ runId });
}

export function createActivationReservationStore(context: StoreContext) {
  return {
    reservePendingActivation: async (scope: MechScope): Promise<Run | null> =>
      await context.atomic(async (transaction) => await reserveActivation(transaction, scope)),
    listPendingMechs: async ({ maxRows = DEFAULT_PENDING_MECHS }: { readonly maxRows?: number } = {}): Promise<
      ReadonlyArray<MechScope>
    > => {
      if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAXIMUM_PENDING_MECHS) {
        throw new StoreConflict('Pending mech page size is invalid');
      }

      const result = await context.client.query(
        `SELECT mailbox.workspace_id,mailbox.mech_id FROM mechane.mech_mailboxes mailbox
         JOIN mechane.mechs mech ON mech.id=mailbox.mech_id JOIN mechane.workspaces workspace ON workspace.id=mailbox.workspace_id
         WHERE mailbox.is_wake_pending AND mech.status='active'
           AND NOT COALESCE((workspace.policy->>'isSuspended')::boolean,false)
           AND (mailbox.active_run_id IS NULL OR EXISTS(
             SELECT 1 FROM mechane.runs WHERE id=mailbox.active_run_id AND status IN ('completed','failed','cancelled')))
         ORDER BY mailbox.updated_at,mailbox.mech_id LIMIT $1`,
        [maxRows],
      );

      return result.rows.map((row: unknown) => {
        const scope = Schema.decodeUnknownSync(Schema.Struct({ workspace_id: Schema.String, mech_id: Schema.String }))(
          row,
        );

        return { workspaceId: scope.workspace_id, mechId: scope.mech_id };
      });
    },
  };
}

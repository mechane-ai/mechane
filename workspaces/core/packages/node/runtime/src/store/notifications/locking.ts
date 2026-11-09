import { Schema } from 'effect';
import type { Run } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { RecordNotFound, StoreConflict } from '../errors.ts';
import { createExecutionReads } from '../execution/reads.ts';

export type MechScope = { readonly workspaceId: string; readonly mechId: string };

const MechState = Schema.Struct({
  id: Schema.String,
  revision: Schema.Number,
  status: Schema.Literals(['active', 'paused', 'archived']),
  is_suspended: Schema.Boolean,
});

const MailboxRow = Schema.Struct({
  workspace_id: Schema.String,
  mech_id: Schema.String,
  session_id: Schema.NullOr(Schema.String),
  active_run_id: Schema.NullOr(Schema.String),
  received_sequence: Schema.Number,
  presented_sequence: Schema.Number,
  is_wake_pending: Schema.Boolean,
  is_environment_checkpoint_required: Schema.Boolean,
  model_messages: Schema.Array(Schema.Unknown),
  is_context_initialized: Schema.Boolean,
});

export async function lockMech(context: StoreContext, scope: MechScope) {
  const locked = await context.client.query('SELECT id FROM mechane.mechs WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [
    scope.workspaceId,
    scope.mechId,
  ]);

  if (locked.rows.length === 0) {
    throw new RecordNotFound('Mech was not found');
  }

  // Re-read after the lock; the row that waited may predate a pause or cancellation.
  const state = await context.client.query(
    `SELECT m.id,m.revision,m.status,COALESCE((w.policy->>'isSuspended')::boolean,false) AS is_suspended
     FROM mechane.mechs m JOIN mechane.workspaces w ON w.id=m.workspace_id WHERE m.id=$1`,
    [scope.mechId],
  );

  await context.client.query(
    'INSERT INTO mechane.mech_mailboxes(workspace_id,mech_id) VALUES($1,$2) ON CONFLICT(mech_id) DO NOTHING',
    [scope.workspaceId, scope.mechId],
  );

  return Schema.decodeUnknownSync(MechState)(state.rows[0]);
}

export async function readMailbox(context: StoreContext, mechId: string) {
  const result = await context.client.query('SELECT * FROM mechane.mech_mailboxes WHERE mech_id=$1', [mechId]);

  if (result.rows.length === 0) {
    throw new StoreConflict('Mech mailbox was not found');
  }

  return Schema.decodeUnknownSync(MailboxRow)(result.rows[0]);
}

export async function lockActivation(context: StoreContext, runId: string): Promise<Run> {
  const run = await createExecutionReads(context).getRun({ runId });

  if (run === null) {
    throw new RecordNotFound('Activation was not found');
  }

  await lockMech(context, run);

  const current = await createExecutionReads(context).getRun({ runId });

  if (current === null) {
    throw new RecordNotFound('Activation was not found');
  }

  return current;
}

export async function requireActiveActivation(context: StoreContext, run: Run): Promise<void> {
  const mailbox = await readMailbox(context, run.mechId);

  if (mailbox.active_run_id !== run.id || run.status !== 'running' || run.cancelRequestedAt !== null) {
    throw new StoreConflict('Activation no longer owns the mech environment');
  }
}

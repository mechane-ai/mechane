import type { StoreContext } from '../context.ts';
import { lockActivation, requireActiveActivation } from './locking.ts';

type RunIdentity = { readonly runId: string };
type CommittedEnvironmentState = 'checkpoint' | 'note_import';

async function recordCommittedEnvironment(
  context: StoreContext,
  { runId }: RunIdentity,
  state: CommittedEnvironmentState,
): Promise<void> {
  await context.atomic(async (transaction) => {
    const run = await lockActivation(transaction, runId);

    await requireActiveActivation(transaction, run);
    await transaction.client.query(
      `UPDATE mechane.mech_mailboxes SET
       is_environment_checkpoint_required=CASE WHEN $2='checkpoint' THEN false ELSE is_environment_checkpoint_required END,
       notes_imported_at=CASE WHEN $2='note_import' THEN COALESCE(notes_imported_at,now()) ELSE notes_imported_at END
       WHERE mech_id=$1`,
      [run.mechId, state],
    );
  });
}

export function createEnvironmentCheckpointStore(context: StoreContext) {
  return {
    markEnvironmentCheckpointCommitted: (input: RunIdentity) =>
      recordCommittedEnvironment(context, input, 'checkpoint'),
    markNotesImported: (input: RunIdentity) => recordCommittedEnvironment(context, input, 'note_import'),
  };
}

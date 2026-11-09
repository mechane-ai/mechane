import { Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { lockActivation } from './locking.ts';

const MemoryExport = Schema.Struct({ path: Schema.String, text: Schema.String, digest: Schema.String });

const WorkExport = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  state: Schema.Literals(['open', 'resolved', 'abandoned']),
  note: Schema.NullOr(Schema.String),
});

export function createStoredNoteImportStore(context: StoreContext) {
  return {
    getStoredNoteImport: async ({ runId }: { readonly runId: string }) =>
      await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, runId);

        const mailbox = await transaction.client.query(
          'SELECT notes_imported_at FROM mechane.mech_mailboxes WHERE mech_id=$1',
          [run.mechId],
        );

        const row = Schema.decodeUnknownSync(Schema.Struct({ notes_imported_at: Schema.NullOr(Schema.String) }))(
          mailbox.rows[0],
        );

        if (row.notes_imported_at !== null) {
          return null;
        }

        const memories = await transaction.client.query(
          'SELECT path,text,digest FROM mechane.memories WHERE mech_id=$1 AND deleted_at IS NULL ORDER BY path',
          [run.mechId],
        );

        const workItems = await transaction.client.query(
          'SELECT id,title,state,note FROM mechane.work_items WHERE mech_id=$1 ORDER BY created_at,id',
          [run.mechId],
        );

        return {
          memories: Schema.decodeUnknownSync(Schema.Array(MemoryExport))(memories.rows),
          workItems: Schema.decodeUnknownSync(Schema.Array(WorkExport))(workItems.rows),
        };
      }),
  };
}

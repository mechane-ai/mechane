import { Schema } from 'effect';
import type { StoreContext } from './context.ts';
import { RecordNotFound, StoreConflict } from './errors.ts';
import { withRunMutation } from './run-mutations.ts';

const ContextRow = Schema.Struct({ summary: Schema.String, covered_message_count: Schema.Number });
const RunScopeRow = Schema.Struct({ workspace_id: Schema.String, mech_id: Schema.String, session_id: Schema.String });
type SessionSelection = { readonly sessionId: string };

type SaveSessionContext = SessionSelection & {
  readonly runId: string;
  readonly summary: string;
  readonly coveredMessageCount: number;
};

type SessionContext = { readonly summary: string; readonly coveredMessageCount: number };

export function createSessionContextStore(context: StoreContext) {
  return {
    getSessionContext: async ({ sessionId }: SessionSelection): Promise<SessionContext | null> => {
      const found = await context.client.query(
        'SELECT summary,covered_message_count FROM mechane.session_contexts WHERE session_id=$1',
        [sessionId],
      );

      if (found.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(ContextRow)(found.rows[0]);

      return { summary: row.summary, coveredMessageCount: row.covered_message_count };
    },
    saveSessionContext: async ({
      sessionId,
      runId,
      summary,
      coveredMessageCount,
    }: SaveSessionContext): Promise<void> => {
      if (!Number.isSafeInteger(coveredMessageCount) || coveredMessageCount < 0 || summary.length === 0) {
        throw new StoreConflict('Session context is invalid');
      }

      await context.atomic(async (transaction) => {
        const scope = await transaction.client.query(
          'SELECT workspace_id,mech_id,session_id FROM mechane.runs WHERE id=$1',
          [runId],
        );

        if (scope.rows.length === 0) {
          throw new RecordNotFound('Session run was not found');
        }

        const run = Schema.decodeUnknownSync(RunScopeRow)(scope.rows[0]);

        if (run.session_id !== sessionId) {
          throw new StoreConflict('Session context does not belong to the run');
        }

        await withRunMutation({
          context: transaction,
          scope: { workspaceId: run.workspace_id, mechId: run.mech_id, runId },
          mutation: async (locked) => {
            const count = await locked.client.query(
              'SELECT count(model_message)::integer AS count FROM mechane.messages WHERE session_id=$1',
              [sessionId],
            );

            const total = Schema.decodeUnknownSync(Schema.Struct({ count: Schema.Number }))(count.rows[0]);

            if (coveredMessageCount > total.count) {
              throw new StoreConflict('Session context covers messages that do not exist');
            }

            const saved = await locked.client.query(
              `
              INSERT INTO mechane.session_contexts(session_id,run_id,summary,covered_message_count)
              VALUES($1,$2,$3,$4) ON CONFLICT(session_id) DO UPDATE
              SET run_id=excluded.run_id,summary=excluded.summary,covered_message_count=excluded.covered_message_count,updated_at=now()
              WHERE mechane.session_contexts.covered_message_count < excluded.covered_message_count
                OR (mechane.session_contexts.covered_message_count=excluded.covered_message_count AND mechane.session_contexts.summary=excluded.summary)
              RETURNING session_id`,
              [sessionId, runId, summary, coveredMessageCount],
            );

            if (saved.rows.length === 0) {
              throw new StoreConflict('Session context was already advanced');
            }
          },
        });
      });
    },
  };
}

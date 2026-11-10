import type { MechScope } from '../api/mechs/mechs.ts';
import { transactionContext } from '../context.ts';
import { StoreConflict } from '../errors.ts';
import type { DatabaseInput } from '../postgres.ts';
import { openPool } from '../postgres.ts';
import { requireSchemaRevision } from '../schema-revision.ts';
import { createImportedHistoryStore } from './history.ts';
import type { ImportedHistory } from './history.ts';

const IMPORT_SCHEMA_REVISION = 5;
export type OpenImportedHistory = ImportedHistory & { readonly close: () => Promise<void> };

function createHistoryGuard(history: ImportedHistory) {
  const verifiedScopes = new Set<string>();

  return function guardedRead<Input extends MechScope, Result>(operation: (input: Input) => Promise<Result>) {
    return async (input: Input): Promise<Result> => {
      const scopeKey = JSON.stringify([input.workspaceId, input.mechId]);

      if (!verifiedScopes.has(scopeKey)) {
        const fence = await history.getExportFence(input);

        if (!fence.scope.isWorkspaceSuspended) {
          throw new StoreConflict('Imported source workspace must be suspended');
        }

        verifiedScopes.add(scopeKey);
      }

      return await operation(input);
    };
  };
}

export async function openImportedHistory({ databaseUrl }: DatabaseInput): Promise<OpenImportedHistory> {
  const pool = openPool({ databaseUrl, maxConnections: 1 });

  const client = await pool.connect().catch(async (error: unknown) => {
    await pool.end();

    throw error;
  });

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const context = transactionContext(client);

    await requireSchemaRevision({ context, minimumVersion: IMPORT_SCHEMA_REVISION });

    const history = createImportedHistoryStore(context).importedHistory;
    const lifecycle = { isClosed: false };
    const guardedRead = createHistoryGuard(history);

    return {
      ...history,
      listRuns: guardedRead(history.listRuns),
      listActivities: guardedRead(history.listActivities),
      getRunTrace: guardedRead(history.getRunTrace),
      getRunCancellation: guardedRead(history.getRunCancellation),
      listNotifications: guardedRead(history.listNotifications),
      getMechContext: guardedRead(history.getMechContext),
      listConsoleMessages: guardedRead(history.listConsoleMessages),
      listMemories: guardedRead(history.listMemories),
      listWorkItems: guardedRead(history.listWorkItems),
      listExecutionReceipts: guardedRead(history.listExecutionReceipts),
      close: async () => {
        if (lifecycle.isClosed) {
          return;
        }

        lifecycle.isClosed = true;

        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
          await pool.end();
        }
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();

    throw error;
  }
}

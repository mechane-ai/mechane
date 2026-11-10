import type { Pool, PoolClient } from 'pg';
import type { ControlChange } from '../control-change.ts';

export type StoreClient = Pool | PoolClient;

export type StoreContext = {
  readonly client: StoreClient;
  readonly atomic: <Result>(operation: (context: StoreContext) => Promise<Result>) => Promise<Result>;
  readonly recordControlChanges: (changes: ReadonlyArray<ControlChange>) => void;
};

export function transactionContext(
  client: PoolClient,
  recordControlChanges: StoreContext['recordControlChanges'] = () => {
    // Read-only import transactions have no command confirmation collector.
  },
): StoreContext {
  const context: StoreContext = { client, atomic: async (operation) => await operation(context), recordControlChanges };

  return context;
}

type CommitTransactionInput<Result> = {
  readonly client: PoolClient;
  readonly run: (context: StoreContext) => Promise<Result>;
  readonly recordControlChanges: StoreContext['recordControlChanges'];
};

async function commitTransaction<Result>({
  client,
  run,
  recordControlChanges,
}: CommitTransactionInput<Result>): Promise<Result> {
  try {
    await client.query('BEGIN');

    const result = await run(transactionContext(client, recordControlChanges));

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  }
}

export function poolContext(
  pool: Pool,
  committed: (changes: ReadonlyArray<ControlChange>) => void = () => {
    // Ordinary store callers retain the outbox for scheduled delivery.
  },
): StoreContext {
  return {
    client: pool,
    recordControlChanges: () => {
      throw new Error('Control changes must be queued in a transaction');
    },
    atomic: async (operation) => {
      const client = await pool.connect();
      let changes: ReadonlyArray<ControlChange> = [];

      try {
        const result = await commitTransaction({
          client,
          run: operation,
          recordControlChanges: (recorded) => {
            changes = [...changes, ...recorded];
          },
        });

        committed(changes);

        return result;
      } finally {
        client.release();
      }
    },
  };
}

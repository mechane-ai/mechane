import type { Pool, PoolClient } from 'pg';

export type StoreClient = Pool | PoolClient;

export type StoreContext = {
  readonly client: StoreClient;
  readonly atomic: <Result>(operation: (context: StoreContext) => Promise<Result>) => Promise<Result>;
};

function transactionContext(client: PoolClient): StoreContext {
  const context: StoreContext = { client, atomic: async (operation) => await operation(context) };

  return context;
}

type CommitTransactionInput<Result> = {
  readonly client: PoolClient;
  readonly run: (context: StoreContext) => Promise<Result>;
};

async function commitTransaction<Result>({ client, run }: CommitTransactionInput<Result>): Promise<Result> {
  try {
    await client.query('BEGIN');

    const result = await run(transactionContext(client));

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    throw error;
  }
}

export function poolContext(pool: Pool): StoreContext {
  return {
    client: pool,
    atomic: async (operation) => {
      const client = await pool.connect();

      try {
        return await commitTransaction({ client, run: operation });
      } finally {
        client.release();
      }
    },
  };
}

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

export function poolContext(pool: Pool): StoreContext {
  return {
    client: pool,
    atomic: async (operation) => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const result = await operation(transactionContext(client));

        await client.query('COMMIT');

        return result;
      } catch (error) {
        await client.query('ROLLBACK');

        throw error;
      } finally {
        client.release();
      }
    },
  };
}

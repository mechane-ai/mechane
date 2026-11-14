import { openSandboxStore } from '@mechane/sandbox-store';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

/** Real SQLite executes the sandbox store's migrations, journals and rollback boundaries. */
export function sqliteStore() {
  const database = new DatabaseSync(':memory:');

  const sql = {
    exec: (query: string, ...bindings: ReadonlyArray<SqlStorageValue>) => {
      // SqlStorage supplies the owning store's complete SQL; this adapter constructs no application statement.
      // ast-grep-ignore: sql-statement-not-literal
      const statement = database.prepare(query);

      const values = bindings.map((value) => {
        if (value instanceof ArrayBuffer) {
          return new Uint8Array(value);
        }

        return value;
      });

      const rows = statement.all(...values);

      return {
        toArray: () => rows,
        one: () => {
          assert.equal(rows.length, 1);

          const row = rows[0];

          assert.ok(row !== undefined);

          return row;
        },
        [Symbol.iterator]: () => rows.values(),
      };
    },
  };

  const transactionSync: DurableObjectStorage['transactionSync'] = (run) => {
    database.exec('SAVEPOINT fixture');

    try {
      const result = run();

      database.exec('RELEASE SAVEPOINT fixture');

      return result;
    } catch (cause) {
      database.exec('ROLLBACK TO SAVEPOINT fixture');
      database.exec('RELEASE SAVEPOINT fixture');

      throw cause;
    }
  };

  const native: unknown = { sql, transactionSync };

  // Cloudflare's storage interface includes platform methods the SQLite fixture never calls.
  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- CF SDK shape
  const storage = native as DurableObjectStorage;

  const store = openSandboxStore({ storage });

  return { store, close: () => database.close() };
}

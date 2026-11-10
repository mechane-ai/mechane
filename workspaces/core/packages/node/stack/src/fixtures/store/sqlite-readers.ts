import { DatabaseSync } from 'node:sqlite';

type SqliteReadersInput = { readonly paths: ReadonlyArray<string> };
type SqliteReaders = { readonly close: () => void };
const SQLITE_INSPECTION_LOCK_WAIT_MS = 5000;

export function holdSqliteReaders({ paths }: SqliteReadersInput): SqliteReaders {
  const databases: Array<DatabaseSync> = [];
  const location: { path?: string } = {};

  try {
    for (const path of paths) {
      location.path = path;

      const database = new DatabaseSync(path, { readOnly: true, timeout: SQLITE_INSPECTION_LOCK_WAIT_MS });

      databases.push(database);
      database.exec('BEGIN; SELECT name FROM sqlite_schema LIMIT 1;');
    }
  } catch (cause) {
    const failure = new Error(`Could not acquire SQLite inspection snapshot for ${JSON.stringify(location.path)}`, {
      cause,
    });

    try {
      closeDatabases(databases);
    } catch (cleanupError) {
      throw new AggregateError([failure, cleanupError], 'Could not open or release the SQLite inspection readers', {
        cause: cleanupError,
      });
    }

    throw failure;
  }

  return { close: () => closeDatabases(databases) };
}

function closeDatabases(databases: ReadonlyArray<DatabaseSync>): void {
  const failures: Array<unknown> = [];

  for (const database of databases) {
    try {
      database.close();
    } catch (cause) {
      failures.push(cause);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Could not release every SQLite inspection reader');
  }
}

import { DatabaseSync } from 'node:sqlite';

type SqliteReadersInput = { readonly paths: ReadonlyArray<string> };
type SqliteReaders = { readonly close: () => void };

export function holdSqliteReaders({ paths }: SqliteReadersInput): SqliteReaders {
  const databases: Array<DatabaseSync> = [];

  try {
    for (const path of paths) {
      const database = new DatabaseSync(path, { readOnly: true });

      databases.push(database);
      database.exec('BEGIN; SELECT name FROM sqlite_schema LIMIT 1;');
    }
  } catch (cause) {
    try {
      closeDatabases(databases);
    } catch (cleanupError) {
      throw new AggregateError([cause, cleanupError], 'Could not open or release the SQLite inspection readers', {
        cause: cleanupError,
      });
    }

    throw cause;
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

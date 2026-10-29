import { Bytes } from '@mechane/records';
import type { CopyRows } from '@mechane/records';
import { decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Array, Option, Schema } from 'effect';
import type { CopyPage, CopyPageInput, CopyRecords } from '../fork.types.ts';
import { referencedFirst } from './referenced-first.ts';
import { takenRows } from './taken-rows.ts';
import type { TableReference } from './types.ts';

/** A fork carries conversation history. New tables require an explicit decision before their state can be inherited. */
const COPIED_TABLES: ReadonlySet<string> = new Set([
  'schema_migrations',
  'turns',
  'inbox_items',
  'events',
  'memory_changes',
  'threads',
  'drones',
  'mech_revisions',
]);

/**
 * The rows one statement of a page reads, each read whole, so no statement is left unfinished to hold the database. The
 * rows a page reads past its bound stay below 32 MB.
 */
const ROWS_PER_COPY_STATEMENT = 16;

/** A table of the database, by its name. */
const TableRow = Schema.Struct({ name: Schema.String });

type TableRow = typeof TableRow.Type;

/** A column of a table's foreign key, as `PRAGMA foreign_key_list` lists it: the table the key names. */
const ForeignKeyRow = Schema.Struct({ table: Schema.String });

type ForeignKeyRow = typeof ForeignKeyRow.Type;

/** How far a page's statements read: on, until a statement fills the page or reads the table's last row. */
const PageReach = { Reading: 'reading', Full: 'full', TableEnd: 'table_end' } as const;

type PageReach = (typeof PageReach)[keyof typeof PageReach];

/** A page read so far: its columns, its rows' values, the rowid of its last row, its bytes and how far it reached. */
type PageRead = {
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<SqlStorageValue>>;
  readonly lastRowid: number;
  readonly pageBytes: Bytes;
  readonly reach: PageReach;
};

/** A table a page reads, and the page as read so far. */
type ReadStatementInput = { readonly table: string; readonly read: PageRead };

/** A name the database lists, of a table or a column. */
type QuotedInput = { readonly name: string };

/**
 * The records of a copy, which reads the approved host tables and pi's conversation storage. Its statements quote each
 * table and column the database listed, and bind every value. A copied table needs a rowid and no generated column,
 * since a page reads `rowid, *` and a write inserts every column.
 */
export function copyRecords({ sql }: RecordsInput): CopyRecords {
  return {
    copiedTables: () => copiedTables({ sql }),
    copyPage: (input) => copyPage({ sql, ...input }),
    writeCopyRows: (input) => writeCopyRows({ sql, ...input }),
  };
}

/**
 * The tables a copy moves: approved history and pi storage. It excludes operational state such as schedules, grants,
 * bindings, and delivery intents, plus SQLite's and the platform's own tables.
 */
function copiedTables({ sql }: RecordsInput): ReadonlyArray<string> {
  const cursor = sql.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite!_%' ESCAPE '!' AND name NOT LIKE '!_%' ESCAPE '!' ORDER BY name",
  );

  const isCopied: (name: string) => boolean = (name) => COPIED_TABLES.has(name) || name.startsWith('pi_');

  const tables = decodeRows({ cursor, schema: TableRow })
    .map(({ name }) => name)
    .filter(isCopied);

  return referencedFirst({ tables, references: tables.flatMap((name) => tableReferences({ sql, name })) });
}

/** The tables a table's foreign keys name; the platform refuses `pragma_foreign_key_list`, so this asks per table. */
function tableReferences({ sql, name }: SqlCall<QuotedInput>): ReadonlyArray<TableReference> {
  // The pragma takes the table it reads by name, one the database listed, so the statement names it.
  // ast-grep-ignore: sql-statement-not-literal
  const cursor = sql.exec(`PRAGMA foreign_key_list(${quoted({ name })})`);

  return decodeRows({ cursor, schema: ForeignKeyRow }).map(({ table }) => ({ name, target: table }));
}

/**
 * Reads rows in rowid order until they fill a page, a few per statement, so the copy moves a table of any size in
 * bounded pages. Each statement is read to its end, since one left unfinished holds the database.
 */
function copyPage({ sql, table, afterRowid }: SqlCall<CopyPageInput>): CopyPage {
  const start: PageRead = {
    columns: [],
    rows: [],
    lastRowid: afterRowid,
    pageBytes: Bytes.make(0),
    reach: PageReach.Reading,
  };

  let read = readStatement({ sql, table, read: start });

  while (read.reach === PageReach.Reading) {
    read = readStatement({ sql, table, read });
  }

  const { columns, rows, lastRowid } = read;

  const next: Option.Option<number> = (() => {
    if (read.reach === PageReach.Full) {
      return Option.some(lastRowid);
    }

    return Option.none();
  })();

  return { table, columns, rows, next };
}

/** Reads one statement's rows after the page's last, and takes those the page has room for. */
function readStatement({ sql, table, read }: SqlCall<ReadStatementInput>): PageRead {
  // The copy reads tables the database lists, so the statement names its table; its bounds are bound.
  // ast-grep-ignore: sql-statement-not-literal
  const cursor = sql.exec(
    `SELECT rowid, * FROM ${quoted({ name: table })} WHERE rowid > ? ORDER BY rowid LIMIT ?`,
    read.lastRowid,
    ROWS_PER_COPY_STATEMENT,
  );

  const [, ...columns] = cursor.columnNames;
  const batch = [...cursor.raw()];
  const taken = takenRows({ batch, pageBytes: read.pageBytes });
  const values = taken.rows.map(([, ...rowValues]) => rowValues);

  const lastRowid = Option.match(Array.last(taken.rows), {
    onNone: () => read.lastRowid,
    onSome: ([rowid]) => Number(rowid),
  });

  const reach: PageReach = (() => {
    if (taken.isFull) {
      return PageReach.Full;
    }

    if (batch.length < ROWS_PER_COPY_STATEMENT) {
      return PageReach.TableEnd;
    }

    return PageReach.Reading;
  })();

  return { columns, rows: [...read.rows, ...values], lastRowid, pageBytes: taken.pageBytes, reach };
}

/** Writes each row in place of one under the same key, such as the ledger rows the object's own migrations wrote. */
function writeCopyRows({ sql, table, columns, rows }: SqlCall<CopyRows<SqlStorageValue>>): void {
  const names = columns.map((name) => quoted({ name })).join(', ');
  const values = columns.map(() => '?').join(', ');

  for (const row of rows) {
    // The copy writes the tables and columns its parent's database listed, so the statement names them; every value
    // is bound.
    // ast-grep-ignore: sql-statement-not-literal
    sql.exec(`INSERT OR REPLACE INTO ${quoted({ name: table })} (${names}) VALUES (${values})`, ...row);
  }
}

/** An identifier as SQLite quotes it, so a name the database lists is read as a name. */
function quoted({ name }: QuotedInput): string {
  return `"${name.replaceAll('"', '""')}"`;
}

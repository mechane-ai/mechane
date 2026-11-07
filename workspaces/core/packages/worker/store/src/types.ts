import type { DateTime } from 'effect';

/** When an object's one alarm fires; only the object's store sets it. */
export type AlarmTimeInput = { readonly at: DateTime.Utc };

/** The SQL client a migration, the ledger or a family of record functions runs against. */
export type RecordsInput = { readonly sql: SqlStorage };

/** One schema step; it runs inside the transaction that records its revision. */
export type Migration = (input: RecordsInput) => void;

type AtomicInput<A> = { readonly run: () => A };

/** The functions of a database as a whole, beside those of its records. */
export type DatabaseFunctions = {
  /** The count of schema migrations the database has applied. */
  readonly schemaRevision: () => number;
  /** Runs `run` in one transaction, so a decision and the writes it makes land together or not at all. */
  readonly atomic: <A>(input: AtomicInput<A>) => A;
};

/** A record function's input together with the SQL client its family binds. */
export type SqlCall<I> = I & RecordsInput;

/** The rows a statement returned. */
export type StatementCursor = SqlStorageCursor<Readonly<Record<string, SqlStorageValue>>>;

/** A statement's rows, and the schema that decodes each of them. */
export type CursorDecoding<S> = { readonly cursor: StatementCursor; readonly schema: S };

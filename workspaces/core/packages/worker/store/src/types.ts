import type { DateTime, Option } from 'effect';

/** When an object's one alarm fires; only the object's store sets it. */
export type AlarmTimeInput = { readonly at: DateTime.Utc };

/** The mech object's one alarm, which the store sets and clears outside every transaction. */
export type AlarmControl = {
  readonly arm: (input: AlarmTimeInput) => Promise<void>;
  readonly disarm: () => Promise<void>;
};

/** The SQL client a migration, the ledger or a family of record functions runs against. */
export type RecordsInput = { readonly sql: SqlStorage };

/** Where a page of a list that grows starts: after the record with the id a reader has last. */
export type PageAfterInput = {
  /** Absent at the list's start. */
  readonly after: Option.Option<string>;
};

/** One schema step; it runs inside the transaction that records its revision. */
export type Migration = (input: RecordsInput) => void;

type AtomicInput<A> = { readonly run: () => A };

/** Runs `run`, whose statements execute synchronously, as one transaction queued behind every one started before it. */
export type AsyncTransaction = <A>(input: AtomicInput<A>) => Promise<A>;

/** The functions of a database as a whole, beside those of its records. */
export type DatabaseFunctions = {
  /** The count of schema migrations the database has applied. */
  readonly schemaRevision: () => number;
  /** Runs `run` in one transaction, so a decision and the writes it makes land together or not at all. */
  readonly atomic: <A>(input: AtomicInput<A>) => A;
};

/** A page of a list's rows, oldest first, and whether more follow them. */
export type RowsPage<Row> = { readonly rows: ReadonlyArray<Row>; readonly hasMore: boolean };

/** A record function's input together with the SQL client its family binds. */
export type SqlCall<I> = I & RecordsInput;

/** The rows a statement returned. */
export type StatementCursor = SqlStorageCursor<Readonly<Record<string, SqlStorageValue>>>;

/** A statement's rows, and the schema that decodes each of them. */
export type CursorDecoding<S> = { readonly cursor: StatementCursor; readonly schema: S };

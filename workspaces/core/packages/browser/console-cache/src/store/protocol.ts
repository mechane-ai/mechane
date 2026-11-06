import { Bytes, RecordId } from '@mechane/records';
import { Schema } from 'effect';

/** Identifies one native transaction while its worker callback owns the connection. */
export const StoreTransactionId = RecordId.pipe(Schema.brand('StoreTransactionId'));

export type StoreTransactionId = typeof StoreTransactionId.Type;

/** The complete set of operations admitted across the owned worker boundary. */
export const StoreCommand = Schema.TaggedUnion({
  Open: { file: Schema.String, maxAge: Schema.DurationFromMillis, maxBytes: Bytes },
  Discard: { file: Schema.String },
  Close: {},
  Begin: { transactionId: StoreTransactionId },
  Commit: { transactionId: StoreTransactionId },
  Rollback: { transactionId: StoreTransactionId },
  Exec: {
    /** Null selects the database outside a transaction. */
    transactionId: Schema.NullOr(StoreTransactionId),
    sql: Schema.String,
  },
  Query: {
    /** Null selects the database outside a transaction. */
    transactionId: Schema.NullOr(StoreTransactionId),
    sql: Schema.String,
    params: Schema.Array(Schema.Unknown),
  },
  Run: {
    /** Null selects the database outside a transaction. */
    transactionId: Schema.NullOr(StoreTransactionId),
    sql: Schema.String,
    params: Schema.Array(Schema.Unknown),
  },
});

export type StoreCommand = typeof StoreCommand.Type;

/** Correlates each decoded worker command with exactly one response. */
export const StoreRequest = Schema.Struct({ requestId: Schema.Int, command: StoreCommand });

export type StoreRequest = typeof StoreRequest.Type;

/** Distinguishes operation failures from failures that invalidate the connection. */
export const StoreReply = Schema.TaggedUnion({
  Ready: {},
  Completed: { requestId: Schema.Int, value: Schema.Unknown },
  Failed: { requestId: Schema.Int, reason: Schema.String },
  Fatal: { reason: Schema.String },
});

export type StoreReply = typeof StoreReply.Type;

/** Validates the row envelope before the native driver applies its caller's row type. */
export const StoreRows = Schema.Array(Schema.Unknown);

export type StoreRows = typeof StoreRows.Type;

/** Carries a local database failure without changing an acknowledged server result. */
export class StoreFailed extends Schema.TaggedError<StoreFailed>()('StoreFailed', { reason: Schema.String }) {
  override get message(): string {
    return this.reason;
  }
}

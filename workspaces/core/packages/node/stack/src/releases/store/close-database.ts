import { Effect, Schema } from 'effect';
import type { DatabaseSync } from 'node:sqlite';

/** Celld's object store at `path` could not be closed, which only a store already closed refuses. */
class StoreUnclosed extends Schema.TaggedError<StoreUnclosed>()('StoreUnclosed', {
  path: Schema.String,
  reason: Schema.String,
}) {}

type CloseDatabaseInput = { readonly database: DatabaseSync; readonly path: string };

/** Closes celld's object store; it runs as a release, so a refusal is a defect. */
export const closeDatabase = Effect.fn('closeDatabase')(function* ({
  database,
  path,
}: CloseDatabaseInput): Effect.fn.Return<void> {
  yield* Effect.try({
    try: () => database.close(),
    catch: (cause) => new StoreUnclosed({ path, reason: String(cause) }),
    // A release: only a store already closed refuses to close.
  }).pipe(Effect.orDie);
});

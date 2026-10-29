import { StepSubject } from '@mechane/program';
import { DateTime, Duration, Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { DatabaseSync } from 'node:sqlite';
import { StackStep } from '../../constants.ts';
import { StackFailed } from '../../errors.ts';
import { closeDatabase } from './close-database.ts';

/** An object to write: its key in the store, which names its bucket, and its bytes. */
type StoredObject = { readonly key: string; readonly body: Uint8Array };

/** An object to write, and the database of celld's object store that takes it. */
type PutObjectInput = StoredObject & { readonly database: DatabaseSync };

/** How long a write to celld's object store waits for the store's lock, which celld holds for its own writes. */
const OBJECT_STORE_BUSY_TIMEOUT = Duration.seconds(30);

/** The ETag celld's object store hands the next object it writes. */
const NextEtag = Schema.Struct({ etag: Schema.Int });

type NextEtag = typeof NextEtag.Type;

type ObjectStoreInput = { readonly path: string };

/** The object store of celld, open: its put writes one object. */
type ObjectStore = { readonly put: (object: StoredObject) => Effect.Effect<void, StackFailed> };

/**
 * Celld's local object store at `path` until the scope closes, which rolls back an unfinished write. Celld's own `r2
 * put` reaches only a cloud bucket, so the stack writes each object into the store as the store's put does.
 */
export const objectStore = Effect.fn('objectStore')(function* ({
  path,
}: ObjectStoreInput): Effect.fn.Return<ObjectStore, never, Scope.Scope> {
  const options = { timeout: Duration.toMillis(OBJECT_STORE_BUSY_TIMEOUT) };

  const database = yield* Effect.acquireRelease(
    Effect.sync(() => new DatabaseSync(path, options)),
    (opened) => closeDatabase({ database: opened, path }),
  );

  const put = Effect.fn('put')(function* ({ key, body }: StoredObject): Effect.fn.Return<void, StackFailed> {
    const subjects = [StepSubject.cases.BucketObject.make({ bucket: path, key })];

    yield* Effect.try({
      try: () => putObject({ database, key, body }),
      catch: (cause) => new StackFailed({ step: StackStep.PutReleaseFile, subjects, reason: String(cause) }),
    });
  });

  return { put };
});

/**
 * Writes one object as the store's put does, in one immediate transaction. It takes the next of the store's ETags and
 * writes the object under it with no HTTP metadata, which a binding reads as none.
 */
function putObject({ database, key, body }: PutObjectInput): void {
  database.exec('BEGIN IMMEDIATE');

  // The statement's RETURNING clause answers one row of `next_etag - 1`, which the store's schema keeps an integer.
  const { etag } = Schema.decodeUnknownSync(NextEtag)(
    database
      .prepare(
        'UPDATE store_sequence SET next_etag = next_etag + 1 WHERE singleton = 1 RETURNING next_etag - 1 AS etag',
      )
      .get(),
  );

  database
    .prepare(
      `INSERT INTO objects(key, body, etag, modified_ms, attributes) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET body = excluded.body, etag = excluded.etag, modified_ms = excluded.modified_ms,
      attributes = excluded.attributes`,
    )
    .run(key, body, etag, DateTime.toEpochMillis(DateTime.nowUnsafe()), '[]');
  database.exec('COMMIT');
}

import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { BrowserFailed, BrowserFailureKind } from '../errors.ts';

type PrepareDirectoryInput = { readonly directory: string };

/** Prepares an owner-only record directory within the browser store. */
export const prepareDirectory = Effect.fn('prepareDirectory')(function* ({
  directory,
}: PrepareDirectoryInput): Effect.fn.Return<void, BrowserFailed> {
  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: 0o700 }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });
});

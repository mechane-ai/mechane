import { Effect } from 'effect';
import { rmSync } from 'node:fs';
import { FileUnwritable } from './errors.ts';

/** A file or folder by its absolute path. */
type RemovePathInput = { readonly path: string };

/** Removes a file, or a folder with everything in it, when it is there. */
export const removePath = Effect.fn('removePath')(function* ({
  path,
}: RemovePathInput): Effect.fn.Return<void, FileUnwritable> {
  yield* Effect.try({
    try: () => rmSync(path, { recursive: true, force: true }),
    catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
  });
});

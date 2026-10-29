import { Effect } from 'effect';
import { rmSync } from 'node:fs';
import { FileUnwritable } from './errors.ts';

/** A file or folder by its absolute path. */
type RemovePathInput = { readonly path: string };

/** Removes a file, or a folder with everything in it, when it is there; a scope's release, it dies if it cannot. */
export const removePath = Effect.fn('removePath')(function* ({ path }: RemovePathInput): Effect.fn.Return<void> {
  yield* Effect.try({
    try: () => rmSync(path, { recursive: true, force: true }),
    catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
    // A scope's release: `rmSync` with `force` refuses only a path the checks do not own.
  }).pipe(Effect.orDie);
});

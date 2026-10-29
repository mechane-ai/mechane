import { Effect, Schema } from 'effect';
import { rm } from 'node:fs/promises';

/** A file or folder of a stack's state could not be removed, which leaves it behind. */
class StateUnremoved extends Schema.TaggedError<StateUnremoved>()('StateUnremoved', {
  path: Schema.String,
  reason: Schema.String,
}) {}

/** A file or folder of a stack's state to remove, and whether it is a folder to remove with everything it holds. */
type RemoveStateInput = { readonly path: string; readonly isRecursive: boolean };

/** Removes a file or folder of a stack's state, as `rm -f` does; it runs as a release, so a refusal is a defect. */
export const removeState = Effect.fn('removeState')(function* ({
  path,
  isRecursive,
}: RemoveStateInput): Effect.fn.Return<void> {
  yield* Effect.tryPromise({
    try: () => rm(path, { recursive: isRecursive, force: true }),
    catch: (cause) => new StateUnremoved({ path, reason: String(cause) }),
    // A release: `rm` with `force` refuses only a path the stack does not own.
  }).pipe(Effect.orDie);
});

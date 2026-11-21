import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

type StageDirectoryInput = { readonly parent: string; readonly prefix: string };

class StagedDirectoryFailed extends Schema.TaggedError<StagedDirectoryFailed>()('StagedDirectoryFailed', {
  reason: Schema.String,
}) {
  override get message(): string {
    return this.reason;
  }
}

export const acquireStagedDirectory = Effect.fn('acquireStagedDirectory')(function* ({
  parent,
  prefix,
}: StageDirectoryInput): Effect.fn.Return<string, StagedDirectoryFailed, Scope.Scope> {
  const template = join(parent, prefix);

  const opening = Effect.tryPromise({
    try: () => mkdtemp(template),
    catch: (cause) => new StagedDirectoryFailed({ reason: String(cause) }),
  });

  const release: (stage: string) => Effect.Effect<void> = (stage) => {
    const removal = Effect.tryPromise({
      try: () => rm(stage, { recursive: true, force: true }),
      catch: (cause) => new StagedDirectoryFailed({ reason: String(cause) }),
    });

    return removal.pipe(Effect.orDie);
  };

  return yield* Effect.acquireRelease(opening, release);
});

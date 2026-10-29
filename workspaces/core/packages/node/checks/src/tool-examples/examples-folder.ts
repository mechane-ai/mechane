import { FileUnwritable, removePath } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The prefix of the folder a run writes the examples to, below the system's temporary folder. */
const EXAMPLES_PREFIX = 'mechane-rule-examples-';

/** A fresh folder below the system's temporary folder, removed with everything in it when the scope closes. */
export const examplesFolder = Effect.fn('examplesFolder')(function* (): Effect.fn.Return<
  string,
  FileUnwritable,
  Scope.Scope
> {
  const temporary = tmpdir();
  const prefix = join(temporary, EXAMPLES_PREFIX);

  return yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => mkdtemp(prefix),
      catch: (cause) => new FileUnwritable({ path: temporary, reason: String(cause) }),
    }),
    (folder) => removePath({ path: folder }),
  );
});

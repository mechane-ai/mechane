import { Effect, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { SuiteInvalid } from './errors.ts';
import { Suite } from './schemas.ts';

/** The suite file as it is written. */
const SuiteFile = Schema.fromJsonString(Suite);

type SuiteFile = typeof SuiteFile.Type;

type ReadSuiteInput = { readonly path: string };

/** The suite the file at `path` holds; a field the suite does not declare is refused, so a misspelled one is seen. */
export const readSuite = Effect.fn('readSuite')(function* ({
  path,
}: ReadSuiteInput): Effect.fn.Return<Suite, SuiteInvalid> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new SuiteInvalid({ path, reason: String(cause) }),
  });

  return yield* Schema.decodeUnknownEffect(SuiteFile, { onExcessProperty: 'error' })(text).pipe(
    Effect.mapError((error) => new SuiteInvalid({ path, reason: error.message })),
  );
});

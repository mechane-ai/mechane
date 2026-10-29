import { InputUnreadable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { cruise } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { Effect, Schema } from 'effect';
import { join, resolve } from 'node:path';
import { CRUISER_CONFIGURATION } from './constants.ts';
import { CruisedModules, CruiseViolation } from './schemas.ts';

/** The result dependency-cruiser returns from a cruise that validates the configuration's rules. */
const CruiseOutput = Schema.Struct({
  modules: CruisedModules,
  summary: Schema.Struct({ violations: Schema.Array(CruiseViolation) }),
});

type CruiseOutput = typeof CruiseOutput.Type;

type CruiseRootsInput = { readonly roots: ReadonlyArray<string> };

/** Cruises the source roots with the options and rules of .dependency-cruiser.cjs, so it resolves as the tool does. */
export const cruiseRoots = Effect.fn('cruiseRoots')(function* ({
  roots,
}: CruiseRootsInput): Effect.fn.Return<CruiseOutput, InputUnreadable> {
  const configuration = join(WORKSPACE_FOLDER, CRUISER_CONFIGURATION);

  const options = yield* Effect.tryPromise({
    try: () => extractDepcruiseOptions(configuration),
    catch: (cause) => new InputUnreadable({ path: CRUISER_CONFIGURATION, reason: String(cause) }),
  });

  // dependency-cruiser reads the package files above `baseDir`, which must not end in a separator.
  const cruiseRoot = resolve(WORKSPACE_FOLDER);

  const result = yield* Effect.tryPromise({
    try: () => cruise([...roots], { ...options, baseDir: cruiseRoot }),
    catch: (cause) => new InputUnreadable({ path: CRUISER_CONFIGURATION, reason: String(cause) }),
  });

  return yield* Schema.decodeUnknownEffect(CruiseOutput)(result.output).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: CRUISER_CONFIGURATION, reason: error.message })),
  );
});

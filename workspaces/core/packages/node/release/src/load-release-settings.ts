import { Effect, Option, Record, Schema } from 'effect';
import { MODE_VARIABLES, ReleaseMode, ReleaseStep } from './constants.ts';
import { ReleaseFailed } from './errors.ts';
import type { InheritedVariablesInput, ReleaseSettings } from './types.ts';

/** Reads the command line and the environment once for the release program; no other module of it reads either. */
export const loadReleaseSettings = Effect.fn('loadReleaseSettings')(function* (): Effect.fn.Return<
  ReleaseSettings,
  ReleaseFailed
> {
  const text = process.argv[2];

  const mode = yield* Schema.decodeUnknownEffect(Schema.Enum(ReleaseMode))(text).pipe(
    Effect.mapError(
      () =>
        new ReleaseFailed({
          step: ReleaseStep.ReadMode,
          reason: `name one of ${Record.values(ReleaseMode).join(', ')}`,
        }),
    ),
  );

  return { mode, inherited: inheritedVariables({ names: MODE_VARIABLES[mode] }) };
});

/** The named parent variables that are set, which the mode's children inherit. */
function inheritedVariables({ names }: InheritedVariablesInput): Readonly<Record<string, string>> {
  const inherited = names.flatMap((name) =>
    Option.toArray(Option.fromNullishOr(process.env[name])).map((value) => [name, value] as const),
  );

  return Record.fromEntries(inherited);
}

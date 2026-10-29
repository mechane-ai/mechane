import { Effect, Option, Record, Schema } from 'effect';
import { MODE_VARIABLES, ReleaseMode, ReleaseStep } from './constants.ts';
import { ReleaseFailed } from './errors.ts';
import type { InheritedVariablesInput, ReleaseSettings } from './types.ts';

/** Reads the command line and the environment once for the release program; no other module of it reads either. */
export function loadReleaseSettings(): Effect.Effect<ReleaseSettings, ReleaseFailed> {
  const text = process.argv[2];

  return Schema.decodeUnknownEffect(Schema.Enum(ReleaseMode))(text).pipe(
    Effect.map((mode) => ({ mode, inherited: inheritedVariables({ names: MODE_VARIABLES[mode] }) })),
    Effect.mapError(
      () =>
        new ReleaseFailed({
          step: ReleaseStep.ReadMode,
          reason: `name one of ${Record.values(ReleaseMode).join(', ')}`,
        }),
    ),
  );
}

/** The named parent variables that are set, which the mode's children inherit. */
function inheritedVariables({ names }: InheritedVariablesInput): Readonly<Record<string, string>> {
  const inherited = names.flatMap((name) =>
    Option.toArray(Option.fromNullishOr(process.env[name])).map((value) => [name, value] as const),
  );

  return Record.fromEntries(inherited);
}

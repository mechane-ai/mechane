import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { IDENTIFIER } from '@mechane/rule-shapes';
import { Effect, Option, Schema } from 'effect';
import { NamesRefused } from './errors.ts';
import type { BindingRename } from './types.ts';

/** A binding's name, as the command line gives it. */
const BindingName = Schema.String.check(Schema.isPattern(IDENTIFIER));

/** The names a binding's rename takes: the binding's, its new one, and the file that declares it when two files do. */
const RenameArguments = Schema.Union([
  Schema.Tuple([BindingName, BindingName]),
  Schema.Tuple([BindingName, BindingName, Schema.String]),
]);

/** What the command line asks for. */
type RenameSettings = {
  /** Absent to apply the committed maps instead. */
  readonly binding: Option.Option<BindingRename>;
};

/**
 * Reads the command line once for the rename program; no other module of it reads it. A binding's name and its new
 * name, with the declaring file when two files declare the name, rename that binding, and no names replay the maps.
 */
export const loadRenameSettings = Effect.fn('loadRenameSettings')(function* (): Effect.fn.Return<
  RenameSettings,
  NamesRefused
> {
  const names = process.argv.slice(PROGRAM_ARGUMENTS_START);

  if (names.length === 0) {
    return { binding: Option.none() };
  }

  const [from, to, file] = yield* Schema.decodeUnknownEffect(RenameArguments)(names).pipe(
    Effect.mapError(() => new NamesRefused({ names })),
  );

  return { binding: Option.some({ from, to, file: Option.fromNullishOr(file) }) };
});

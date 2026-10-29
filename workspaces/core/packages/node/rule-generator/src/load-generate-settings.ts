import { Effect, Option, Record, Schema } from 'effect';
import { GenerateCommand, GenerateStep } from './constants.ts';
import { GenerateFailed } from './errors.ts';
import type { GeneratorRun } from './types.ts';

/** A question about the registry: the rules a rule's name or its standard rule names, or the rules of a path. */
type RegistryQuery = {
  readonly command: typeof GenerateCommand.Explain | typeof GenerateCommand.For;
  /** The rule's name or standard rule, such as `boolean-names` or `EF-02`, or a path relative to the workspace. */
  readonly subject: string;
};

/** The index of the program's first own argument in `process.argv`, after the runtime's path and the script's. */
const PROGRAM_ARGUMENTS_START = 2;

/** What the program reads from its command line: a run of the generator, or a question about the registry. */
type GenerateSettings = GeneratorRun | RegistryQuery;

/**
 * Reads the command line once: `write`, the default, or `check`, or `explain` or `for` with the rule or path they ask
 * about. No other module of the program reads it.
 */
export const loadGenerateSettings = Effect.fn('loadGenerateSettings')(function* (): Effect.fn.Return<
  GenerateSettings,
  GenerateFailed
> {
  const [command = GenerateCommand.Write, subject] = process.argv.slice(PROGRAM_ARGUMENTS_START);

  const unknownCommand: () => GenerateFailed = () =>
    new GenerateFailed({
      step: GenerateStep.Read,
      path: `the command ${command}`,
      reason: `name one of ${Record.values(GenerateCommand).join(', ')}`,
    });

  const decoded = yield* Schema.decodeUnknownEffect(Schema.Enum(GenerateCommand))(command).pipe(
    Effect.mapError(unknownCommand),
  );

  const named = Option.fromNullishOr(subject);

  if (decoded === GenerateCommand.Write || decoded === GenerateCommand.Check) {
    return { command: decoded };
  }

  if (Option.isNone(named)) {
    return yield* new GenerateFailed({
      step: GenerateStep.Read,
      path: `the command ${decoded}`,
      reason: 'name a rule or a path, such as `boolean-names`, `EF-02` or `packages/node/checks/src/main.ts`',
    });
  }

  return { command: decoded, subject: named.value };
});

import { ArgumentsMismatched, CommandUnnamed, InputInvalid, UsageInvalid } from '@mechane/cli-kernel';
import type { CommandInput, CommandName, OutputMode } from '@mechane/commands';
import { COMMANDS } from '@mechane/commands';
import { Array, Effect, Option, Record, Schema } from 'effect';

/** The command the positional arguments name, and its decoded input. */
type SelectedCommand<N extends CommandName = CommandName> = { readonly command: N; readonly input: CommandInput<N> };

type DecodeCommandInput = {
  readonly positionals: ReadonlyArray<string>;
  /** The values of the flags that are not global, which only the selected command may accept. */
  readonly values: Readonly<Record<string, unknown>>;
  readonly output: OutputMode;
};

type SelectCommandInput = { readonly positionals: ReadonlyArray<string>; readonly output: OutputMode };

/**
 * The command whose words begin the positional arguments, with its input decoded from the rest and from its flags. Its
 * input schema refuses a flag that only another command declares.
 */
export const decodeCommand = Effect.fn('decodeCommand')(function* ({
  positionals,
  values,
  output,
}: DecodeCommandInput): Effect.fn.Return<SelectedCommand, UsageInvalid> {
  const name = yield* selectCommand({ positionals, output });
  const command = COMMANDS[name];
  const rest = positionals.slice(name.split(' ').length);
  const argumentNames = command.arguments.map((argument) => argument.name);

  if (rest.length !== argumentNames.length) {
    const problem = new ArgumentsMismatched({ command: name, arguments: argumentNames });

    return yield* new UsageInvalid({ problem, output });
  }

  const inputFailure: (error: Schema.SchemaError) => UsageInvalid = (error) =>
    new UsageInvalid({ problem: new InputInvalid({ command: name, reason: error.message }), output });

  const input = yield* Schema.decodeUnknownEffect(command.input, { onExcessProperty: 'error' })({
    ...values,
    ...Record.fromEntries(Array.zip(argumentNames, rest)),
  }).pipe(Effect.mapError(inputFailure));

  return { command: name, input };
});

/** The command whose words the positional arguments begin with. */
const selectCommand = Effect.fn('selectCommand')(function* ({
  positionals,
  output,
}: SelectCommandInput): Effect.fn.Return<CommandName, UsageInvalid> {
  const isTyped: (name: CommandName) => boolean = (name) =>
    name.split(' ').every((word, index) => positionals[index] === word);

  const name = Array.findFirst(Record.keys(COMMANDS), isTyped);

  if (Option.isNone(name)) {
    return yield* new UsageInvalid({ problem: new CommandUnnamed(), output });
  }

  return name.value;
});

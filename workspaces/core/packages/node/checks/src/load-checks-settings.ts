import { BASE_BRANCH, InputUnreadable } from '@mechane/checks-kernel';
import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Option, Record, Schema } from 'effect';
import { resolve } from 'node:path';
import { ChecksCommand } from './constants.ts';
import type { ChecksSettings } from './types.ts';

/** The variables the checks' children inherit: git and Bun are found on `PATH`, and git reads the home folder. */
const INHERITED_VARIABLES = ['PATH', 'HOME'] as const;

/** A variable the checks' children inherit, by its name. */
type InheritedVariable = (typeof INHERITED_VARIABLES)[number];

/** What a command takes from the arguments after its name: a fix's rule, and the paths. */
type CommandArguments = Pick<ChecksSettings, 'rule' | 'paths'>;

/** A command and the arguments the command line names after it. */
type CommandArgumentsInput = { readonly command: ChecksCommand; readonly rest: ReadonlyArray<string> };

/** Reads the command line and the environment once for the checks program; no other module of it reads either. */
export const loadChecksSettings = Effect.fn('loadChecksSettings')(function* (): Effect.fn.Return<
  ChecksSettings,
  InputUnreadable
> {
  const [text, ...rest] = process.argv.slice(PROGRAM_ARGUMENTS_START);

  /** A variable's entry when the environment sets it; the children inherit only the variables it sets. */
  const inheritedEntry: (name: InheritedVariable) => ReadonlyArray<readonly [string, string]> = (name) =>
    Option.toArray(Option.fromNullishOr(process.env[name])).map((value) => [name, value] as const);

  const inherited = Record.fromEntries(INHERITED_VARIABLES.flatMap(inheritedEntry));

  const baseBranch = Option.getOrElse(
    Option.fromNullishOr(process.env[BASE_BRANCH.variable]),
    () => BASE_BRANCH.fallback,
  );

  /** The failure of a command line whose first argument names no command. */
  const unknownCommand: () => InputUnreadable = () =>
    new InputUnreadable({
      path: `the command ${String(text)}`,
      reason: `name one of ${Record.values(ChecksCommand).join(', ')}`,
    });

  const command = yield* Schema.decodeUnknownEffect(Schema.Enum(ChecksCommand))(text).pipe(
    Effect.mapError(unknownCommand),
  );

  return { command, ...commandArguments({ command, rest }), baseBranch, inherited };
});

/** A fix names its rule before its paths; every other argument of a command is a path. */
function commandArguments({ command, rest }: CommandArgumentsInput): CommandArguments {
  if (command !== ChecksCommand.Fix) {
    return { rule: Option.none(), paths: rest.map((path) => resolve(path)) };
  }

  const [rule, ...paths] = rest;

  return { rule: Option.fromNullishOr(rule), paths: paths.map((path) => resolve(path)) };
}

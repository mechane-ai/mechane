import { BASE_BRANCH, InputUnreadable } from '@mechane/checks-kernel';
import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Option, Record, Schema } from 'effect';
import { resolve } from 'node:path';
import { ChecksCommand } from './constants.ts';
import type { ChecksSettings } from './types.ts';

/** Target children inherit tool lookup and the operator's local container connection. */
const INHERITED_VARIABLES = [
  'PATH',
  'HOME',
  'TMPDIR',
  'XDG_RUNTIME_DIR',
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_CONFIG',
  'CONTAINER_HOST',
  'CELLD_CONTAINER_HOST_SERVICES',
  'MECHANE_NODE_EXECUTABLE',
  'NODE_OPTIONS',
] as const;

/** A variable the checks' children inherit, by its name. */
type InheritedVariable = (typeof INHERITED_VARIABLES)[number];

/** Target execution keeps its arguments intact; fix and file commands resolve their paths. */
type CommandArguments = Pick<ChecksSettings, 'rule' | 'paths' | 'target' | 'targetArguments'>;

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

/** Target arguments remain separate argv entries, including a scenario filter containing spaces. */
function commandArguments({ command, rest }: CommandArgumentsInput): CommandArguments {
  if (command === ChecksCommand.RunTarget) {
    const [target, ...targetArguments] = rest;

    return { rule: Option.none(), paths: [], target: Option.fromNullishOr(target), targetArguments };
  }

  if (command !== ChecksCommand.Fix) {
    return {
      rule: Option.none(),
      paths: rest.map((path) => resolve(path)),
      target: Option.none(),
      targetArguments: [],
    };
  }

  const [rule, ...paths] = rest;

  return {
    rule: Option.fromNullishOr(rule),
    paths: paths.map((path) => resolve(path)),
    target: Option.none(),
    targetArguments: [],
  };
}

import { Option } from 'effect';
import { commandReference } from './command-reference.ts';
import type { CommandReference } from './schemas.ts';

/**
 * The column widths of `--help`: names of commands, global flags, command options and variables, then statuses. The
 * options' column holds the longest, `[--daily-cap-micros]`, and two spaces.
 */
const HELP_COLUMNS = { commandChars: 16, flagChars: 10, optionChars: 22, variableChars: 18, statusChars: 5 } as const;

/** A command as the reference publishes it. */
type ReferenceCommand = CommandReference['commands'][number];

type CommandLinesInput = { readonly command: ReferenceCommand };

/** The lines `--help` prints, rendered from the command reference. */
export function helpLines(): ReadonlyArray<string> {
  const { program, release, commands, flags, variables, exitStatuses } = commandReference();
  const readFrom: (variable: string) => string = (variable) => `; read from ${variable} when absent`;

  const flagLine: (flag: CommandReference['flags'][number]) => string = ({ name, summary, variable }) =>
    `  --${name.padEnd(HELP_COLUMNS.flagChars)}${summary}${Option.match(variable, { onNone: () => '', onSome: readFrom })}`;

  const variableLine: (variable: CommandReference['variables'][number]) => string = ({ name, summary }) =>
    `  ${name.padEnd(HELP_COLUMNS.variableChars)}${summary}`;

  const statusLine: (exit: CommandReference['exitStatuses'][number]) => string = ({ name, status }) =>
    `  ${String(status).padEnd(HELP_COLUMNS.statusChars)}${name}`;

  return [
    `${program} ${release}`,
    `usage: ${program} <command> [arguments] [flags]`,
    `text that starts with - goes after --, with every flag before it: ${program} inbox send <mech-id> -- '- item'; a flag value that starts with - is written --instructions='- be terse'`,
    '',
    'commands:',
    ...commands.flatMap((command) => commandLines({ command })),
    '',
    'flags:',
    ...flags.map(flagLine),
    '',
    'variables:',
    ...variables.map(variableLine),
    '',
    'exit statuses:',
    ...exitStatuses.map(statusLine),
  ];
}

/** A command's line, then one line for each argument it requires and each flag it accepts, in brackets if optional. */
function commandLines({ command }: CommandLinesInput): ReadonlyArray<string> {
  const argumentLine: (argument: ReferenceCommand['arguments'][number]) => string = ({ name, summary }) =>
    `    ${`<${name}>`.padEnd(HELP_COLUMNS.optionChars)}${summary}`;

  const flagLine: (flag: ReferenceCommand['flags'][number]) => string = ({ name, summary, isRequired }) => {
    const usage: string = (() => {
      if (isRequired) {
        return `--${name}`;
      }

      return `[--${name}]`;
    })();

    return `    ${usage.padEnd(HELP_COLUMNS.optionChars)}${summary}`;
  };

  return [
    `  ${command.name.padEnd(HELP_COLUMNS.commandChars)}${command.summary}`,
    ...command.arguments.map(argumentLine),
    ...command.flags.map(flagLine),
  ];
}

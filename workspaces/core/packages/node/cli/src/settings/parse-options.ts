import { COMMANDS, FlagKind, GLOBAL_FLAGS } from '@mechane/commands';
import type { CommandDeclaration } from '@mechane/commands';
import { Record } from 'effect';
import type { ParseArgsOptionsConfig } from 'node:util';

/** The `parseArgs` type of each kind of flag. */
const PARSE_TYPE = { [FlagKind.Text]: 'string', [FlagKind.Switch]: 'boolean' } as const;

/** The `parseArgs` options of every flag the command model declares, global or of one command. */
export function parseOptions(): ParseArgsOptionsConfig {
  const commandFlags = Record.values(COMMANDS).flatMap((command: CommandDeclaration) =>
    Record.toEntries(command.flags),
  );

  const flags = { ...Record.fromEntries(commandFlags), ...GLOBAL_FLAGS };

  return Record.map(flags, (flag) => ({ type: PARSE_TYPE[flag.kind] }));
}

import type { ReferenceNames } from './schemas.ts';

type FlagNamesInput = { readonly reference: ReferenceNames };

/** The global flags, then each command's flags under its words, such as `key create --key-file`. */
export function flagNames({ reference }: FlagNamesInput): ReadonlyArray<string> {
  const globalFlag: (flag: ReferenceNames['flags'][number]) => string = ({ name }) => `--${name}`;

  /** Each flag of one command, under the command's words. */
  const commandFlags: (command: ReferenceNames['commands'][number]) => ReadonlyArray<string> = (command) => {
    const commandFlag: (flag: ReferenceNames['flags'][number]) => string = ({ name }) => `${command.name} --${name}`;

    return command.flags.map(commandFlag);
  };

  return [...reference.flags.map(globalFlag), ...reference.commands.flatMap(commandFlags)];
}

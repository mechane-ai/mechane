import { WORKER_VARIABLES } from '@mechane/deployment';
import { INSTALL_FOLDER_VARIABLE } from '@mechane/protocol';
import { GUEST_VARIABLES } from '@mechane/sandbox-wire';
import { Option, Record } from 'effect';
import type { ReferenceNames } from './schemas.ts';

type VariableNamesInput = { readonly reference: ReferenceNames };

/** Each variable a shipped program reads, once: the CLI's, the Worker's, the guest's and the install script's. */
export function variableNames({ reference }: VariableNamesInput): ReadonlyArray<string> {
  const flagVariable: (flag: ReferenceNames['flags'][number]) => ReadonlyArray<string> = ({ variable }) =>
    Option.toArray(Option.fromUndefinedOr(variable));

  const names = [
    ...reference.flags.flatMap(flagVariable),
    ...reference.variables.map(({ name }) => name),
    ...Record.values(WORKER_VARIABLES),
    ...Record.values(GUEST_VARIABLES),
    INSTALL_FOLDER_VARIABLE,
  ];

  return [...new Set(names)];
}

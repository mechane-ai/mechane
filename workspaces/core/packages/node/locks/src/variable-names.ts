import { INSTALL_FOLDER_VARIABLE } from '@mechane/protocol';
import { GUEST_VARIABLES } from '@mechane/sandbox-wire';
import { Option, Record } from 'effect';
import type { ReferenceNames } from './schemas.ts';

type VariableNamesInput = { readonly reference: ReferenceNames };

/** Public CLI, guest and installer variables; release-owned Worker bindings are installed with their bundle. */
export function variableNames({ reference }: VariableNamesInput): ReadonlyArray<string> {
  const flagVariable: (flag: ReferenceNames['flags'][number]) => ReadonlyArray<string> = ({ variable }) =>
    Option.toArray(Option.fromUndefinedOr(variable));

  const names = [
    ...reference.flags.flatMap(flagVariable),
    ...reference.variables.map(({ name }) => name),
    ...Record.values(GUEST_VARIABLES),
    INSTALL_FOLDER_VARIABLE,
  ];

  return [...new Set(names)];
}

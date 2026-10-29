import { StatementKind } from '@mechane/modules';
import type { AddedStatement } from '@mechane/modules';
import { relativeSpecifier } from '@mechane/program';
import { Option } from 'effect';
import type { Requirement } from '../packages.types.ts';

/** An entry relative to the workspace, and the names other members take from it that it does not export yet. */
type ReexportsInput = { readonly path: string; readonly missing: ReadonlyArray<Requirement> };

/** One re-export for each missing name, which merge by file and type-ness after the entry's last statement. */
export function reexports({ path, missing }: ReexportsInput): ReadonlyArray<AddedStatement> {
  const values: ReadonlySet<string> = new Set(
    missing.filter(({ isTypeOnly }) => !isTypeOnly).map(({ exported }) => exported),
  );

  const unique = new Map(missing.map((requirement) => [requirement.exported, requirement]));

  /** The re-export of one name from the file that declares it. */
  const reexport: (requirement: Requirement) => AddedStatement = ({ name, exported, path: declaring }) => ({
    kind: StatementKind.Reexport,
    isTypeOnly: !values.has(exported),
    specifier: relativeSpecifier({ importer: path, target: declaring }),
    target: Option.none(),
    names: [{ imported: name, local: exported }],
    anchor: Option.none(),
  });

  return [...unique.values()].map(reexport);
}

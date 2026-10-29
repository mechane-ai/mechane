import { inScope, StatementKind } from '@mechane/modules';
import type { ModuleStatement, NormalizerScope } from '@mechane/modules';
import { Option } from 'effect';
import { sep } from 'node:path';

/** A statement of the file at `path`, the barrels that go, the entries and the scope. */
type EntryTargetInput = {
  readonly statement: ModuleStatement;
  readonly path: string;
  readonly barrels: ReadonlySet<string>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/**
 * The entry a statement passes through: a barrel the normalizer removes, or, for an import of a file under the scope,
 * the entry of the library that holds the file. A library holds the files of each of its source roots.
 */
export function entryTarget({ statement, path, barrels, entries, scope }: EntryTargetInput): Option.Option<string> {
  const isScopedImport = statement.kind === StatementKind.Import && inScope({ path, scope });

  /** Whether the file lies below the folder of the library whose entry it is. */
  const isOwnLibrary: (folder: string) => boolean = (folder) => path.startsWith(`${folder}${sep}`);

  /** Whether the statement passes through the target: a barrel, or its own library's entry. */
  const isPassed: (target: string) => boolean = (target) =>
    barrels.has(target) || (isScopedImport && Option.exists(Option.fromNullishOr(entries.get(target)), isOwnLibrary));

  return Option.filter(statement.target, isPassed);
}

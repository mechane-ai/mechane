import { ENTRY_FILE, inScope, StatementKind } from '@mechane/modules';
import type { ModuleStatement, NormalizerScope } from '@mechane/modules';
import { Option } from 'effect';
import { basename, sep } from 'node:path';

/** A statement of the file at `path`, the barrels that go, the entries and the scope. */
type EntryTargetInput = {
  readonly statement: ModuleStatement;
  readonly path: string;
  readonly barrels: ReadonlySet<string>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/**
 * Finds a removable barrel or the owning library's index for an import within the scope. Public defining modules
 * already name the declaration directly.
 */
export function entryTarget({ statement, path, barrels, entries, scope }: EntryTargetInput): Option.Option<string> {
  const isScopedImport = statement.kind === StatementKind.Import && inScope({ path, scope });

  /** Whether the file lies below the folder of the library whose entry it is. */
  const isOwnLibrary: (folder: string) => boolean = (folder) => path.startsWith(`${folder}${sep}`);

  /** Defining modules must stay direct: rewriting their imports would point back to the same file on every pass. */
  const isPassed: (target: string) => boolean = (target) => {
    if (basename(target) !== ENTRY_FILE) {
      return false;
    }

    return (
      barrels.has(target) || (isScopedImport && Option.exists(Option.fromNullishOr(entries.get(target)), isOwnLibrary))
    );
  };

  return Option.filter(statement.target, isPassed);
}

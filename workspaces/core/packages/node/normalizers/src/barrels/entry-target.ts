import { ENTRY_FILE, inScope, StatementKind } from '@mechane/modules';
import type { ModuleStatement, NormalizerScope } from '@mechane/modules';
import { Option } from 'effect';
import { basename, dirname, sep } from 'node:path';

/** A statement of the file at `path`, the barrels that go, the entries and the scope. */
type EntryTargetInput = {
  readonly statement: ModuleStatement;
  readonly path: string;
  readonly barrels: ReadonlySet<string>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/** Imports within one public module use defining files. Imports between published subpaths preserve their boundary. */
export function entryTarget({ statement, path, barrels, entries, scope }: EntryTargetInput): Option.Option<string> {
  const isScopedImport = statement.kind === StatementKind.Import && inScope({ path, scope });

  /** Defining modules must stay direct: rewriting their imports would point back to the same file on every pass. */
  const isPassed: (target: string) => boolean = (target) => {
    if (basename(target) !== ENTRY_FILE) {
      return false;
    }

    const targetFolder = dirname(target);

    const crossesPublicModule = [...entries.keys()].some((entry) => {
      const prefix = `${dirname(entry)}${sep}`;

      if (!path.startsWith(prefix)) {
        return false;
      }

      return !target.startsWith(prefix) || !path.startsWith(`${targetFolder}${sep}`);
    });

    const isOwnLibrary: (folder: string) => boolean = (folder) =>
      path.startsWith(`${folder}${sep}`) && !crossesPublicModule;

    return (
      barrels.has(target) || (isScopedImport && Option.exists(Option.fromNullishOr(entries.get(target)), isOwnLibrary))
    );
  };

  return Option.filter(statement.target, isPassed);
}

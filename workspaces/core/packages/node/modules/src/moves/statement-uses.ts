import { Option } from 'effect';
import { originKey } from '../origin-key.ts';
import { exportOrigin } from '../statements/export-origin.ts';
import type { ExportTable, ModuleName, ModuleStatement } from '../types.ts';
import type { KeyedUse } from './types.ts';

/** Every file's exports, a file relative to the workspace, and one of its statements. */
type StatementUsesInput = { readonly table: ExportTable; readonly path: string; readonly statement: ModuleStatement };

/** Each name a statement takes from a workspace file, by the key of what it takes through every re-export. */
export function statementUses({ table, path, statement }: StatementUsesInput): ReadonlyArray<KeyedUse> {
  if (Option.isNone(statement.target)) {
    return [];
  }

  const target = statement.target.value;

  /** A name's use, under the key of the declaration it takes; none when no file declares it. */
  const nameUse: (name: ModuleName) => ReadonlyArray<KeyedUse> = (name) => {
    const origin = exportOrigin({ table, path: target, name: name.imported });

    return Option.toArray(Option.map(origin, originKey)).map((key) => ({ key, use: { path, statement, name } }));
  };

  return statement.names.flatMap(nameUse);
}

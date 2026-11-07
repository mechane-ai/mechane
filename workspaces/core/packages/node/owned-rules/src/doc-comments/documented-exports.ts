import { exportOrigin, exportTable } from '@mechane/modules';
import type { Origin, ParsedSource } from '@mechane/modules';
import { CONTRACTS } from '@mechane/rules';
import { Array, Option, Record } from 'effect';
import type { DocumentedExports } from './types.ts';

type DocumentedExportsInput = { readonly sources: ReadonlyArray<ParsedSource> };

/** Follow supported interface entrypoints to the declarations whose contracts callers rely on. */
export function documentedExports({ sources }: DocumentedExportsInput): DocumentedExports {
  const { publicEntrypoints } = CONTRACTS['code-comment-content'].values;
  const table = exportTable({ sources });

  const entryOrigins: (path: string) => ReadonlyArray<Origin> = (path) => {
    const declarations = table.get(path);
    const exports = Option.fromNullishOr(declarations);
    const names = Option.toArray(exports).flatMap((entries) => [...entries.keys()]);

    return names.flatMap((name) => {
      const origin = exportOrigin({ table, path, name });

      return Option.toArray(origin);
    });
  };

  const origins = publicEntrypoints.flatMap(entryOrigins);
  const groups = Array.groupBy(origins, ({ path }) => path);

  const entry: (group: readonly [string, ReadonlyArray<Origin>]) => readonly [string, ReadonlySet<string>] = ([
    path,
    declarations,
  ]) => {
    const names = declarations.map(({ name }) => name);

    return [path, new Set(names)];
  };

  const entries = Record.toEntries(groups).map(entry);

  return new Map(entries);
}

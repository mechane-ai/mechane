import { fileFacts } from '../declarations/file-facts.ts';
import { exportTable } from '../statements/export-table.ts';
import type { ExportTable, FileFacts, NameUse, ParsedSource, PlacementIndex } from '../types.ts';
import { DECLARATION_FILE } from './constants.ts';
import { entryOrigins } from './entry-origins.ts';
import { statementUses } from './statement-uses.ts';
import type { KeyedUse } from './types.ts';

type NameUsesInput = { readonly files: ReadonlyMap<string, FileFacts>; readonly table: ExportTable };

/** The parsed members' files and the entries their manifests export. */
type PlacementIndexInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
};

/**
 * What one round reads of the workspace: each file's facts, and every name each statement takes by its declaration. It
 * pins the declarations the entries export, which placement leaves where they are.
 */
export function placementIndex({ sources, entries }: PlacementIndexInput): PlacementIndex {
  /** Whether the file holds code, unlike a declaration file. */
  const isCode: (source: ParsedSource) => boolean = ({ path }) => !path.endsWith(DECLARATION_FILE);

  /** A file's facts under its path. */
  const factsEntry: (source: ParsedSource) => readonly [string, FileFacts] = (source) => [
    source.path,
    fileFacts({ source }),
  ];

  const files = new Map(sources.filter(isCode).map(factsEntry));
  const table = exportTable({ sources });

  return {
    files,
    table,
    uses: nameUses({ files, table }),
    entries: new Set(entries.keys()),
    pinned: new Set([...entries.keys()].flatMap((entry) => entryOrigins({ entry, table }))),
  };
}

/** Every use of a declaration by the key of what it takes, through every re-export. */
function nameUses({ files, table }: NameUsesInput): ReadonlyMap<string, ReadonlyArray<NameUse>> {
  /** The uses a file's statements make. */
  const fileUses: (facts: FileFacts) => ReadonlyArray<KeyedUse> = ({ source, statements }) =>
    statements.flatMap((statement) => statementUses({ table, path: source.path, statement }));

  /** A key's uses, under the key. */
  const keyUses: (group: readonly [string, ReadonlyArray<KeyedUse>]) => readonly [string, ReadonlyArray<NameUse>] = ([
    key,
    group,
  ]) => [key, group.map(({ use }) => use)];

  const keyed = [...files.values()].flatMap(fileUses);

  return new Map([...Map.groupBy(keyed, ({ key }) => key)].map(keyUses));
}

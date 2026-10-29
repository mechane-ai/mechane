import type { ExportLink, ExportTable, ParsedSource } from '../types.ts';
import { statementExports } from './statement-exports.ts';

type ExportTableInput = { readonly sources: ReadonlyArray<ParsedSource> };

/**
 * Each file's exports by name: what the file declares and exports, and what it re-exports from another workspace file.
 * A name a file imports and declares again as a type is the file's own export.
 */
export function exportTable({ sources }: ExportTableInput): ExportTable {
  /** A file's exports by name, under the file's path. */
  const fileEntry: (source: ParsedSource) => readonly [string, ReadonlyMap<string, ExportLink>] = ({
    path,
    parsed,
  }) => [path, new Map(parsed.program.body.flatMap((statement) => statementExports({ path, statement })))];

  return new Map(sources.map(fileEntry));
}

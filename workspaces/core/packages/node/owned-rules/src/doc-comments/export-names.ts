import { Array, Option } from 'effect';
import type { StaticExport } from 'oxc-parser';

type ExportNamesInput = { readonly statement: StaticExport };

/** The names an export statement exports; a default export has none. */
export function exportNames({ statement }: ExportNamesInput): ReadonlyArray<string> {
  return Array.getSomes(statement.entries.map(({ exportName }) => Option.fromNullishOr(exportName.name)));
}

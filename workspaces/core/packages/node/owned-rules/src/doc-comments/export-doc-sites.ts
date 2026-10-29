import type { Site } from '@mechane/checks-kernel';
import { ENTRY_FILE, lineAt } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import { basename } from 'node:path';
import type { StaticExport, StaticExportEntry } from 'oxc-parser';
import { DocRule } from './constants.ts';
import { declaringExports } from './declaring-exports.ts';
import { exportNames } from './export-names.ts';
import type { AttachedDocs } from './types.ts';

/** The suffix of an input type, which the doc of the function it names covers. */
const INPUT_SUFFIX = 'Input';

type ExportDocSitesInput = { readonly source: ParsedSource; readonly attached: AttachedDocs };

type CoveredInput = { readonly entry: StaticExportEntry; readonly values: ReadonlySet<string> };

/**
 * Each declaring export without a doc comment above it. The doc of a value covers the type named like it, and the doc
 * of a function its input type. An entry point's re-exports are covered by their own files.
 */
export function exportDocSites({ source, attached }: ExportDocSitesInput): ReadonlyArray<Site> {
  if (basename(source.path) === ENTRY_FILE) {
    return [];
  }

  const valueEntries = source.parsed.module.staticExports
    .flatMap(({ entries }) => entries)
    .filter(({ isType }) => !isType);

  const values: ReadonlySet<string> = new Set(
    Array.getSomes(valueEntries.map(({ exportName }) => Option.fromNullishOr(exportName.name))),
  );

  /** Whether no doc comment sits above the statement and another doc covers none of its entries. */
  const isUndocumented: (statement: StaticExport) => boolean = ({ start, entries }) =>
    !attached.has(start) && !entries.every((entry) => isCovered({ entry, values }));

  /** The site of an export without a doc comment. */
  const exportSite: (statement: StaticExport) => Site = (statement) => ({
    rule: DocRule.Export,
    file: source.path,
    line: lineAt({ text: source.text, offset: statement.start }),
    message: `Document \`${exportNames({ statement }).join(', ')}\` in a doc comment above it, such as \`/** What it holds */\``,
  });

  return declaringExports({ source }).filter(isUndocumented).map(exportSite);
}

/** Whether another doc covers a type entry: the doc of the value named like it, or of the function it is input to. */
function isCovered({ entry, values }: CoveredInput): boolean {
  /** Whether the type is named like a value or ends as an input type. */
  const isCoveredName: (name: string) => boolean = (name) => values.has(name) || name.endsWith(INPUT_SUFFIX);

  return entry.isType && Option.exists(Option.fromNullishOr(entry.exportName.name), isCoveredName);
}

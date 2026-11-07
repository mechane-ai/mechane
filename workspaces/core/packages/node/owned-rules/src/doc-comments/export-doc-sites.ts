import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import type { StaticExport, StaticExportEntry } from 'oxc-parser';
import { DocRule } from './constants.ts';
import { declaringExports } from './declaring-exports.ts';
import { exportNames } from './export-names.ts';
import type { AttachedDocs } from './types.ts';

/** The suffix of an input type, which the doc of the function it names covers. */
const INPUT_SUFFIX = 'Input';

type ExportDocSitesInput = {
  readonly source: ParsedSource;
  readonly attached: AttachedDocs;
  readonly documented: ReadonlySet<string>;
};

type CoveredInput = { readonly entry: StaticExportEntry; readonly values: ReadonlySet<string> };

/**
 * Each supported public declaration without a doc comment. Re-exports inherit documentation from their origin. A
 * value's doc covers its matching type, and a function's doc covers its input type.
 */
export function exportDocSites({ source, attached, documented }: ExportDocSitesInput): ReadonlyArray<Site> {
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

  const isPublic: (statement: StaticExport) => boolean = (statement) =>
    exportNames({ statement }).some((name) => documented.has(name));

  return declaringExports({ source }).filter(isPublic).filter(isUndocumented).map(exportSite);
}

/** Whether another doc covers a type entry: the doc of the value named like it, or of the function it is input to. */
function isCovered({ entry, values }: CoveredInput): boolean {
  /** Whether the type is named like a value or ends as an input type. */
  const isCoveredName: (name: string) => boolean = (name) => values.has(name) || name.endsWith(INPUT_SUFFIX);

  return entry.isType && Option.exists(Option.fromNullishOr(entry.exportName.name), isCoveredName);
}

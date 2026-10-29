import type { Site } from '@mechane/checks-kernel';
import { lineAt, TYPESCRIPT_EXTENSION } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import { basename } from 'node:path';
import type { StaticExport, StaticExportEntry } from 'oxc-parser';
import { extraExports } from './extra-exports.ts';
import { isBehaviorStem } from './is-behavior-stem.ts';
import type { ExportedName } from './types.ts';

/** The one-value rule: a behavior file exports one value its stem spells, and types it names or derives. */
const ONE_VALUE_RULE = 'one-value';

/** What the site of a behavior file that exports no value asks for. */
const NO_VALUE_MESSAGE = 'Export the one value this file is named for, or name it for its role, such as `types.ts`';

type OneValueSitesInput = { readonly source: ParsedSource };

/** Where a site of the rule starts in its file, and what it asks for. */
type SiteAt = { readonly offset: number; readonly message: string };

/**
 * Each export a behavior file holds beyond its one value, or its lack of a value. An extra export is a value its stem
 * does not spell, or a type that its stem does not name and its value does not derive.
 */
export function oneValueSites({ source }: OneValueSitesInput): ReadonlyArray<Site> {
  const stem = basename(source.path, TYPESCRIPT_EXTENSION);

  if (!isBehaviorStem({ stem })) {
    return [];
  }

  const exported = exportedNames({ source });

  /** A site of the rule in the file at `offset`. */
  const oneValueSite: (at: SiteAt) => Site = ({ offset, message }) => ({
    rule: ONE_VALUE_RULE,
    file: source.path,
    line: lineAt({ text: source.text, offset }),
    message,
  });

  if (exported.every(({ isType }) => isType)) {
    return [oneValueSite({ offset: 0, message: NO_VALUE_MESSAGE })];
  }

  return extraExports({ exported, stem }).map(({ start, message }) => oneValueSite({ offset: start, message }));
}

/** Each name a file exports, whether it is a type, and its export statement's start and text. */
function exportedNames({ source }: OneValueSitesInput): ReadonlyArray<ExportedName> {
  /** Each name an export statement exports, with its statement's start and text. */
  const statementNames: (statement: StaticExport) => ReadonlyArray<ExportedName> = ({ start, end, entries }) => {
    const declaration = source.text.slice(start, end);

    /** An entry's name, when it has one. */
    const entryName: (entry: StaticExportEntry) => Option.Option<ExportedName> = ({ exportName, isType }) =>
      Option.map(Option.fromNullishOr(exportName.name), (name) => ({ name, isType, start, declaration }));

    return Array.getSomes(entries.map(entryName));
  };

  return source.parsed.module.staticExports.flatMap(statementNames);
}

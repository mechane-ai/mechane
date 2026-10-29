import type { Finding } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { spellsStem } from '@mechane/program';
import { basename } from 'node:path';
import { CONCEPT_ROLE_STEM, ROLE_FILE_STEMS } from './constants.ts';
import { fileExports } from './file-exports.ts';

/** The file stems of the role files, entry points, output modules and executables, which may export any name. */
const FREE_EXPORT_STEMS: ReadonlySet<string> = new Set([...ROLE_FILE_STEMS, 'index', 'output', 'main']);

type FileNamesInput = { readonly sources: ReadonlyArray<ParsedSource> };

type NamedFileInput = { readonly source: ParsedSource };

/**
 * Finds each behavior file that exports no name its stem spells, in camel, Pascal or upper snake case, whatever the
 * case of each word. A role file, a concept's among them, and a module the runtime loads by its default export are
 * exempt.
 */
export function fileNameFindings({ sources }: FileNamesInput): ReadonlyArray<Finding> {
  /** Whether the file must be named for an export: a behavior file, with no free stem and no concept's role stem. */
  const isNamedFile: (source: ParsedSource) => boolean = ({ path }) => {
    const stem = basename(path, TYPESCRIPT_EXTENSION);

    return !FREE_EXPORT_STEMS.has(stem) && !CONCEPT_ROLE_STEM.test(stem);
  };

  return sources.filter(isNamedFile).flatMap((source) => namedFileFindings({ source }));
}

/** A file that exports no name its stem spells and no default export. */
function namedFileFindings({ source }: NamedFileInput): ReadonlyArray<Finding> {
  const file = source.path;
  const { names, hasDefault } = fileExports({ source });
  const stem = basename(file, TYPESCRIPT_EXTENSION);

  if (hasDefault || names.some((name) => spellsStem({ name, stem }))) {
    return [];
  }

  const message = `Name the file for its primary export or split it, such as \`create-store.ts\` for \`createStore\`, since none of its exports spells its stem: ${names.join(', ')}`;

  return [{ check: 'file-names', location: file, message }];
}

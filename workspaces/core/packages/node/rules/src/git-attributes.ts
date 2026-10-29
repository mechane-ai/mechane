import { VOCABULARY_FOLDER } from './constants.ts';
import type { GeneratedFile } from './types.ts';

/** The workspace's attributes file, which marks each generated file and how a merge treats it. */
const GIT_ATTRIBUTES = '.gitattributes';

type GitAttributesInput = { readonly paths: ReadonlyArray<string> };

/**
 * The workspace's `.gitattributes`: every file the registry generates, itself included, is generated and keeps this
 * side in a merge, which `mise run fix` then writes again from the registry. The word lists merge as the union of both
 * sides' lines, so two changes that each add a word both land.
 */
export function gitAttributes({ paths }: GitAttributesInput): GeneratedFile {
  const generatedLine: (path: string) => string = (path) => `/${path} linguist-generated merge=ours`;
  const generated = [...paths, GIT_ATTRIBUTES].toSorted().map(generatedLine);

  const text = [
    '# Generated from @mechane/rules by `mise run fix`; change the registry, never this file.',
    '# A merge keeps this side of each generated file, and `mise run fix` writes it again from the registry.',
    ...generated,
    '# A merge takes both sides of a word list, and `mise run fix` sorts its words again.',
    `/${VOCABULARY_FOLDER}/*.txt merge=union`,
    '',
  ];

  return { path: GIT_ATTRIBUTES, text: text.join('\n') };
}

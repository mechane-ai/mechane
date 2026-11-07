import { Array } from 'effect';
import { posix } from 'node:path';
import type { GeneratedFile } from '../types.ts';
import { AST_GREP_RULES, GENERATED_HEADER } from './constants.ts';

/** A generated parser rule's source matcher and the metadata that differs from it. */
export type ParserCompanion = {
  readonly source: string;
  readonly path: string;
  readonly language: 'TypeScript' | 'Tsx';
  readonly files: ReadonlyArray<string>;
  readonly utilities: ReadonlyArray<string>;
};

/** ast-grep needs a separate rule for each parser; each pair keeps one authored matcher. */
export const PARSER_COMPANIONS: ReadonlyArray<ParserCompanion> = [
  {
    source: posix.join(AST_GREP_RULES, 'boolean-names.yml'),
    path: posix.join(AST_GREP_RULES, 'boolean-names-tsx.yml'),
    language: 'Tsx',
    files: ['packages/browser/**/*.tsx'],
    utilities: ['boolean-prefix', 'native-boolean-name', 'keyboard-modifier-name', 'external-boolean-property'],
  },
  {
    source: posix.join(AST_GREP_RULES, 'ui-control-geometry.yml'),
    path: posix.join(AST_GREP_RULES, 'ui-control-geometry-typescript.yml'),
    language: 'TypeScript',
    files: [
      'packages/browser/elements/packages/foundations/src/control-styles.ts',
      'packages/browser/elements/packages/forms/src/field-styles.ts',
      'packages/browser/elements/packages/forms/src/selection-styles.ts',
    ],
    utilities: [],
  },
  {
    source: posix.join(AST_GREP_RULES, 'ui-visual-token-values-typescript.yml'),
    path: posix.join(AST_GREP_RULES, 'ui-visual-token-values.yml'),
    language: 'Tsx',
    files: ['packages/browser/**/*.tsx'],
    utilities: ['ui-style-value'],
  },
];

type ParserCompanionInput = { readonly companion: ParserCompanion; readonly text: string };

/** Only parser metadata and language-specific utility references differ from the source matcher. */
export function parserCompanion({ companion, text }: ParserCompanionInput): GeneratedFile {
  const name = posix.basename(companion.path, '.yml');
  const filePatterns = JSON.stringify(companion.files);
  const languageSuffix = companion.language.toLowerCase();

  const metadata = text
    .replace(/^id:.*$/m, `id: ${name}`)
    .replace(/^language:.*$/m, `language: ${companion.language}`)
    .replace(/^files:[\s\S]*?(?=^\S)/m, `files: ${filePatterns}\n`);

  const matcher = Array.reduce(companion.utilities, metadata, (source, utility) =>
    source.replaceAll(`matches: ${utility}`, `matches: ${utility}-${languageSuffix}`),
  );

  return { path: companion.path, text: `${GENERATED_HEADER}\n# Matcher source: ${companion.source}.\n${matcher}` };
}

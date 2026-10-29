import { posix } from 'node:path';
import type { GeneratedFile } from '../types.ts';
import { AST_GREP_UTILITIES, GENERATED_HEADER } from './constants.ts';
import { yamlScalar } from './yaml-scalar.ts';

/** One generated ast-grep utility: the id rules match it by, and its rule's one key and value. */
type UtilityFileInput = { readonly utility: string; readonly key: string; readonly value: string | number };

/** A utility's file: a header naming its source, then its id, its language and its one-key rule, as YAML. */
export function utilityFile({ utility, key, value }: UtilityFileInput): GeneratedFile {
  const text = [
    GENERATED_HEADER,
    `id: ${utility}`,
    'language: TypeScript',
    'rule:',
    `  ${key}: ${yamlScalar({ value })}`,
    '',
  ];

  return { path: posix.join(AST_GREP_UTILITIES, `${utility}.yml`), text: text.join('\n') };
}

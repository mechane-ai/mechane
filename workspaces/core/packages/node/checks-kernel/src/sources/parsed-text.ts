import type { ParsedSource } from '@mechane/modules';
import { parseSync } from 'oxc-parser';
import type { TextFile } from '../types.ts';

/** A TypeScript file's text parsed once as a module, for every owned rule that reads its syntax. */
export function parsedText({ path, text }: TextFile): ParsedSource {
  return { path, text, parsed: parseSync(path, text, { sourceType: 'module', lang: 'ts' }) };
}

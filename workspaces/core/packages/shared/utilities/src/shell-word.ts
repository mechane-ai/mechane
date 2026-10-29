import type { TextInput } from './types.ts';

/** Text as one word of a POSIX shell script: single-quoted, with each single quote in it closed, escaped, reopened. */
export function shellWord({ text }: TextInput): string {
  return `'${text.replaceAll("'", String.raw`'\''`)}'`;
}

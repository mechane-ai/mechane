import type { Memory } from '@mechane/protocol';
import { DateTime } from 'effect';
import { indentedText } from './indented-text.ts';

type MemoryLinesInput = { readonly memory: Memory };

/** One saved memory as a person reads it: its path, version, and the turn that saved it and when, then its text. */
export function memoryLines({ memory }: MemoryLinesInput): ReadonlyArray<string> {
  return [
    `${memory.path} v${memory.version} saved at ${DateTime.formatIso(memory.savedAt)} by turn ${memory.turnId}`,
    ...indentedText({ text: memory.text }),
  ];
}

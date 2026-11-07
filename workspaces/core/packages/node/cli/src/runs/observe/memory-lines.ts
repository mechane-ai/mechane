import type { Memory } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { indentedText } from './indented-text.ts';

type MemoryLinesInput = { readonly memory: Memory };

/** Imported memories omit run provenance when none was recorded. */
export function memoryLines({ memory }: MemoryLinesInput): ReadonlyArray<string> {
  const provenance = Option.match(memory.turnId, { onNone: () => '', onSome: (turnId) => ` by turn ${turnId}` });

  return [
    `${memory.path} v${memory.version} saved at ${DateTime.formatIso(memory.savedAt)}${provenance}`,
    ...indentedText({ text: memory.text }),
  ];
}

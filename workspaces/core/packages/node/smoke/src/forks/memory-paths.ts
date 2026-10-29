import type { MemoryList } from '@mechane/protocol';

/** A mech's memories as `mechane memory list` answers them. */
type MemoryInput = { readonly memory: MemoryList };

/** The paths of a mech's memories, in the order `mechane memory list` shows them. */
export function memoryPaths({ memory }: MemoryInput): string {
  return memory.memories.map(({ path }) => path).join(',');
}

import type { StoreContext } from '@mechane/authority-store';
import { memoryDocuments } from './memory-documents.ts';
import { pruneMemoryVersions } from './memory-retention.ts';
import { memoryStores } from './memory-stores.ts';
import { memoryVersions } from './memory-versions.ts';
import { workerMemory } from './memory-worker.ts';

export function createManagedMemoryStore(context: StoreContext) {
  return {
    pruneVersions: async () => await pruneMemoryVersions(context),
    workerDocuments: workerMemory(context),
    ...memoryStores(context),
    ...memoryDocuments(context),
    ...memoryVersions(context),
  };
}

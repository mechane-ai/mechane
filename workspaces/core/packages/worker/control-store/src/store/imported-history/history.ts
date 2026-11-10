import type { StoreContext } from '../context.ts';
import { createImportedContextStore } from './context.ts';
import { createImportInventoryStore } from './inventory.ts';
import { createImportedRunStore } from './reads.ts';

export function createImportedHistoryStore(context: StoreContext) {
  return {
    importedHistory: {
      ...createImportedRunStore(context),
      ...createImportedContextStore(context),
      ...createImportInventoryStore(context),
    },
  };
}

export type ImportedHistory = ReturnType<typeof createImportedHistoryStore>['importedHistory'];

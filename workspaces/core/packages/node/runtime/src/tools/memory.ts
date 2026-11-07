import { withRuntimeStore } from '../store/runtime-store.ts';
import type { RuntimeToolContext } from './types.ts';

type ReadMemoryInput = RuntimeToolContext & { readonly path?: string | undefined };

type WriteMemoryInput = RuntimeToolContext & {
  readonly path: string;
  readonly text: string;
  readonly expectedVersion: number | null;
};

type DeleteMemoryInput = RuntimeToolContext & { readonly path: string; readonly expectedVersion: number };

export async function readMemory(input: ReadMemoryInput) {
  'use step';

  return await withRuntimeStore(async (store) => {
    if (input.path === undefined) {
      return await store.listMemories({ workspaceId: input.workspaceId, mechId: input.mechId });
    }

    return await store.getMemory({ workspaceId: input.workspaceId, mechId: input.mechId, path: input.path });
  });
}

export async function writeMemory(input: WriteMemoryInput) {
  'use step';

  return await withRuntimeStore(async (store) => {
    const memory = await store.writeMemory(input);

    if (memory === null) {
      return { status: 'conflict', message: 'The memory changed. Read its current version before writing again.' };
    }

    return { status: 'written', memory };
  });
}

export async function deleteMemory(input: DeleteMemoryInput) {
  'use step';

  return await withRuntimeStore(async (store) => {
    const isDeleted = await store.deleteMemory(input);

    if (!isDeleted) {
      return {
        status: 'conflict',
        message: 'The memory changed or was removed. Read its current version before deleting it.',
      };
    }

    return { status: 'deleted' };
  });
}

writeMemory.maxRetries = 0;
deleteMemory.maxRetries = 0;

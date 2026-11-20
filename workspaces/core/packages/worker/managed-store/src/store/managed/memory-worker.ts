import { ManagedStoreError } from '@mechane/authority-store';
import type { ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { memoryDocuments } from './memory-documents.ts';
import type { MemoryQuery, MemoryView } from './memory-input.ts';
import { readWorkerSessionResources } from './session-records.ts';
import { lockManagedResourceWork } from './work-authorization.ts';

type WorkerMemoryOperation =
  | { readonly operation: 'list'; readonly query: MemoryQuery }
  | ({ readonly operation: 'get'; readonly memoryId: string } & MemoryView)
  | ({ readonly operation: 'create'; readonly body: ManagedDocument } & MemoryView)
  | ({ readonly operation: 'update'; readonly memoryId: string; readonly body: ManagedDocument } & MemoryView)
  | { readonly operation: 'delete'; readonly memoryId: string; readonly expectedHash?: string | undefined };

const reads: ReadonlySet<WorkerMemoryOperation['operation']> = new Set(['get', 'list']);

export type WorkerMemoryRequest = WorkerMemoryOperation & {
  readonly session: { readonly workspaceId: string; readonly sessionId: string };
  readonly token: string;
  readonly scope: ManagedScope;
  readonly storeId: string;
};

export function workerMemory(context: StoreContext) {
  return async (input: WorkerMemoryRequest) => {
    const { session, scope, storeId } = input;

    if (session.workspaceId !== scope.workspaceId) {
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory store');
    }

    return await context.atomic(async (transaction) => {
      const resources = await readWorkerSessionResources(transaction, session);

      await lockManagedResourceWork(transaction, { ...session, token: input.token });

      const mount = resources.find(
        (resource) => resource['type'] === 'memory_store' && resource['memory_store_id'] === storeId,
      );

      if (mount === undefined) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory store');
      }

      if (mount['access'] !== 'read_write' && !reads.has(input.operation)) {
        throw new ManagedStoreError(HttpStatusCode.Forbidden, 'Memory mount is read-only');
      }

      // A pinned grant can outlive the creator's role; confine it to this store and these document operations.
      const grant = {
        scope: { workspaceId: scope.workspaceId, principalId: scope.principalId, isAdmin: true },
        storeId,
        actor: { type: 'session_actor' as const, session_id: session.sessionId },
      };

      const documents = memoryDocuments(transaction);

      switch (input.operation) {
        case 'list':
          return await documents.listMemories({ ...grant, query: input.query });
        case 'get':
          return await documents.getMemory({ ...grant, memoryId: input.memoryId, view: input.view });
        case 'create':
          return await documents.createMemory({ ...grant, body: input.body, view: input.view });
        case 'update':
          return await documents.updateMemory({
            ...grant,
            memoryId: input.memoryId,
            body: input.body,
            view: input.view,
          });
        case 'delete':
          return await documents.deleteMemory({ ...grant, memoryId: input.memoryId, expectedHash: input.expectedHash });
      }
    });
  };
}

import { ManagedStoreError } from '@mechane/control-store';
import { HttpStatusCode } from '@mechane/records';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';
import { workerBearer } from './work-auth.ts';

function pathValue(params: ManagedRequest['params'], key: string) {
  const value = params[key];

  if (value === undefined || value.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, `Missing memory path parameter ${key}`);
  }

  return value;
}

function memoryView(value: unknown): 'basic' | 'full' | undefined {
  switch (value) {
    case 'basic':
    case 'full':
    case undefined:
      return value;
    default:
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid memory view');
  }
}

function memoryQuery(values: ManagedRequest['query']) {
  return {
    ...managedPageQuery(values),
    view: memoryView(values['view']),
    ...(typeof values['depth'] === 'number' && { depth: values['depth'] }),
    ...(typeof values['path_prefix'] === 'string' && { pathPrefix: values['path_prefix'] }),
    ...(typeof values['memory_id'] === 'string' && { memoryId: values['memory_id'] }),
    ...(typeof values['session_id'] === 'string' && { sessionId: values['session_id'] }),
    ...(typeof values['api_key_id'] === 'string' && { apiKeyId: values['api_key_id'] }),
    ...(typeof values['service_account_id'] === 'string' && { serviceAccountId: values['service_account_id'] }),
    ...(typeof values['operation'] === 'string' && { operation: values['operation'] }),
  };
}

export async function handleMemory(request: ManagedRequest): Promise<unknown> {
  const { store, scope, body, operation, params, workerSession } = request;
  const memory = store.managed.memory;
  const query = memoryQuery(request.query);
  const { view } = query;
  const expectedHash = request.query['expected_content_sha256'];

  if (expectedHash !== undefined && typeof expectedHash !== 'string') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid memory SHA-256');
  }

  if (workerSession !== undefined) {
    const storeId = params['memory_store_id'];

    if (storeId === undefined || storeId.length === 0) {
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory operation');
    }

    const grant = { scope, storeId, session: workerSession, token: workerBearer(request.request) };

    switch (operation) {
      case 'BetaListMemories':
        return await memory.workerDocuments({ ...grant, operation: 'list', query });
      case 'BetaGetMemory':
        return await memory.workerDocuments({
          ...grant,
          operation: 'get',
          memoryId: pathValue(params, 'memory_id'),
          view,
        });
      case 'BetaCreateMemory':
        return await memory.workerDocuments({ ...grant, operation: 'create', body, view });
      case 'BetaUpdateMemory':
        return await memory.workerDocuments({
          ...grant,
          operation: 'update',
          memoryId: pathValue(params, 'memory_id'),
          body,
          view,
        });
      case 'BetaDeleteMemory':
        return await memory.workerDocuments({
          ...grant,
          operation: 'delete',
          memoryId: pathValue(params, 'memory_id'),
          expectedHash,
        });
      default:
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory operation');
    }
  }

  if (operation === 'BetaCreateMemoryStore') {
    return await memory.createStore({ scope, body });
  }

  if (operation === 'BetaListMemoryStores') {
    return await memory.listStores({ scope, query });
  }

  const target = { scope, storeId: pathValue(params, 'memory_store_id') };

  switch (operation) {
    case 'BetaGetMemoryStore':
      return await memory.getStore(target);
    case 'BetaUpdateMemoryStore':
      return await memory.updateStore({ ...target, body });
    case 'BetaArchiveMemoryStore':
      return await memory.archiveStore(target);
    case 'BetaDeleteMemoryStore':
      return await memory.deleteStore(target);
    case 'BetaCreateMemory':
      return await memory.createMemory({ ...target, body, view });
    case 'BetaGetMemory':
      return await memory.getMemory({ ...target, memoryId: pathValue(params, 'memory_id'), view });
    case 'BetaUpdateMemory':
      return await memory.updateMemory({ ...target, memoryId: pathValue(params, 'memory_id'), body, view });
    case 'BetaDeleteMemory':
      return await memory.deleteMemory({ ...target, memoryId: pathValue(params, 'memory_id'), expectedHash });
    case 'BetaListMemories':
      return await memory.listMemories({ ...target, query });
    case 'BetaGetMemoryVersion':
      return await memory.getVersion({ ...target, versionId: pathValue(params, 'memory_version_id'), view });
    case 'BetaRedactMemoryVersion':
      return await memory.redactVersion({ ...target, versionId: pathValue(params, 'memory_version_id') });
    case 'BetaListMemoryVersions':
      return await memory.listVersions({ ...target, query });
    default:
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory operation');
  }
}

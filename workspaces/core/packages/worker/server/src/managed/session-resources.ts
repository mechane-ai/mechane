import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import type { ManagedRequest } from './types.ts';

const ResourceList = Schema.Array(Schema.Record(Schema.String, Schema.Unknown));
type Resource = (typeof ResourceList.Type)[number];
const RESOURCE_PAGE_MAX_ROWS = 1000;

function resourceId(resource: Resource): string {
  const id = resource['id'] ?? resource['memory_store_id'];

  return Schema.decodeUnknownSync(Schema.NonEmptyString)(id);
}

function resourcePageSize(value: unknown, totalRows: number): number {
  if (value === undefined) {
    return totalRows;
  }

  if (typeof value !== 'number' || value < 1 || value > RESOURCE_PAGE_MAX_ROWS) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Resource page size must be between 1 and 1000');
  }

  return value;
}

function listResources(resources: ReadonlyArray<Resource>, query: ManagedRequest['query']) {
  const cursor = query['page'];
  const maxRows = resourcePageSize(query['limit'], resources.length);
  const start = resources.findIndex((resource) => resourceId(resource) === cursor) + 1;

  if (cursor !== undefined && start === 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid resource page cursor');
  }

  const rows = resources.slice(start, start + maxRows);
  const last = rows.at(-1);

  if (last !== undefined && start + rows.length < resources.length) {
    return { data: rows, next_page: resourceId(last) };
  }

  return { data: rows, next_page: null };
}

export async function sessionResources(input: ManagedRequest, sessionId: string): Promise<unknown> {
  const { store, scope, operation, params, query, body } = input;

  if (operation === 'BetaAddResource') {
    return await store.managed.sessions.addFileResource({ scope, sessionId, body });
  }

  if (operation === 'BetaDeleteResource') {
    const targetId = params['resource_id'];

    if (targetId === undefined || targetId.length === 0) {
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Session resource not found');
    }

    return await store.managed.sessions.deleteFileResource({ scope, sessionId, resourceId: targetId });
  }

  const session = await store.managed.sessions.get({ scope, id: sessionId });
  const resources = Schema.decodeUnknownSync(ResourceList)(session['resources']);

  if (operation === 'BetaListResources') {
    return listResources(resources, query);
  }

  const id = params['resource_id'];
  const resource = resources.find((entry) => resourceId(entry) === id);

  if (id === undefined || resource === undefined) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'Session resource not found');
  }

  switch (operation) {
    case 'BetaGetResource':
      return resource;
    case 'BetaUpdateResource':
      return await store.managed.vaults.rotateGitResourceToken({ scope, sessionId, resourceId: id, body });
    default:
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Unknown session resource operation');
  }
}

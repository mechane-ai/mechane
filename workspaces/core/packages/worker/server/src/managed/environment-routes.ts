import { ManagedStoreError } from '@mechane/control-store';
import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';

type KeyRequest = {
  readonly request: Request;
  readonly store: ControlStore;
  readonly peerAddress: string | null;
  readonly authenticate: (request: Request, peerAddress: string | null) => Promise<ManagedScope>;
};

const KeyPath = /^\/internal\/managed\/environments\/([^/]+)\/keys(?:\/([^/]+))?$/u;

export async function handleManagedEnvironmentKeys({ request, store, peerAddress, authenticate }: KeyRequest) {
  const match = KeyPath.exec(new URL(request.url).pathname);

  if (match === null) {
    return null;
  }

  const [, id, keyId] = match;

  if (id === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment not found.');
  }

  const scope = await authenticate(request, peerAddress);
  const environments = store.managed.worker.environments;
  const headers = { [HttpHeader.CacheControl]: 'no-store' };

  if (request.method === HttpMethod.Post && keyId === undefined) {
    const key = await environments.issueKey({ scope, id });

    return Response.json(key, { headers });
  }

  if (request.method === HttpMethod.Delete && keyId !== undefined) {
    const result = await environments.revokeKey({ scope, id, keyId });

    return Response.json(result, { headers });
  }

  throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment key operation not found.');
}

export async function handleEnvironmentOperation({ operation, params, query, body, scope, store }: ManagedRequest) {
  const environments = store.managed.worker.environments;

  if (operation === 'beta_create_environment_v1_environments_post') {
    return await environments.create({ scope, body });
  }

  if (operation === 'beta_list_environments_v1_environments_get') {
    return await environments.list({ scope, query: managedPageQuery(query) });
  }

  const id = params['environment_id'];

  if (id === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment not found.');
  }

  switch (operation) {
    case 'beta_get_environment_v1_environments__environment_id__get': {
      const environment = await environments.get({ scope, id });

      if (environment === null) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment not found.');
      }

      return environment;
    }
    case 'beta_update_environment_v1_environments__environment_id__post':
      return await environments.update({ scope, id, body });
    case 'beta_archive_environment_v1_environments__environment_id__archive_post':
      return await environments.archive({ scope, id });
    case 'beta_delete_environment_v1_environments__environment_id__delete':
      return await environments.remove({ scope, id });
    default:
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment operation not found.');
  }
}

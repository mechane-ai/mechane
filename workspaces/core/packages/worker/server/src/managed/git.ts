import { ManagedStoreError } from '@mechane/control-store';
import type { ControlStore } from '@mechane/control-store';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { verifyManagedHost } from '@mechane/runtime';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { readGitOperation } from '@mechane/sandbox-wire';
import type { GitIdentityRequest, GitOperation } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { RequestHandler } from '../application.ts';
import { GitPushRejected } from './git-push-policy.ts';
import { openManagedGitTransfer } from './git-transfer.ts';
import { forwardGit, gitErrorResponse } from './git-transport.ts';
import { ManagedHttpError } from './http-error.ts';
import { requireWorkerWorkspace, workerBearer } from './work-auth.ts';

type GitHandlerInput = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

type GitRequest = GitHandlerInput & {
  readonly request: Request;
  readonly operation: GitOperation | GitIdentityRequest;
};

const UPSTREAM_PATH = /^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u;

function gitDestination(repository: string, operation: GitOperation): URL | null {
  if (!URL.canParse(repository)) {
    return null;
  }

  const url = new URL(repository);

  if (url.href !== repository || url.protocol !== 'https:') {
    return null;
  }

  const hasUserInfo = url.username !== '' || url.password !== '';

  if (hasUserInfo || url.hash !== '' || url.search !== '') {
    return null;
  }

  if (!UPSTREAM_PATH.test(url.pathname) || url.pathname.endsWith('.git')) {
    return null;
  }

  url.pathname = `${url.pathname}.git/${operation.path}`;

  if (operation.isAdvertisement) {
    url.searchParams.set('service', operation.service);
  }

  return url;
}

async function serveGit({ store, configuration, request, operation }: GitRequest): Promise<Response> {
  const token = workerBearer(request);

  if (token.length === 0) {
    return gitErrorResponse(HttpStatusCode.Unauthorized, 'Worker authentication required');
  }

  const work = await store.managed.worker.tokenScope({ token });

  if (work === null) {
    return gitErrorResponse(HttpStatusCode.Unauthorized, 'Invalid or expired work credential');
  }

  if (work.sessionId !== operation.sessionId) {
    return gitErrorResponse(HttpStatusCode.Forbidden, 'Worker cannot access this session');
  }

  requireWorkerWorkspace(request, work.workspaceId);

  const policy = configuration.managedGit;

  if ('isIdentity' in operation) {
    const { commitAuthorName, commitAuthorEmail } = policy;

    return Response.json(
      { commitAuthorName, commitAuthorEmail },
      { headers: { [HttpHeader.CacheControl]: 'no-store' } },
    );
  }

  const resource = await store.managed.vaults.gitResourceForWork({
    workspaceId: work.workspaceId,
    sessionId: work.sessionId,
    resourceId: operation.resourceId,
  });

  const url = gitDestination(resource.url, operation);

  if (url === null || !policy.allowedHostnames.includes(url.host)) {
    return gitErrorResponse(HttpStatusCode.Forbidden, 'Git repository host is not allowed');
  }

  try {
    await verifyManagedHost({
      url,
      allowedHostnames: new Set([url.hostname]),
      privateHostnames: new Set(policy.privateHostnames),
      allowNonPublicLiterals: false,
    });
  } catch {
    return gitErrorResponse(HttpStatusCode.Forbidden, 'Git repository host has no authorized address');
  }

  const isPush = operation.service === 'git-receive-pack';

  if (isPush && (resource.token === null || policy.allowedPushRefs.length === 0)) {
    return gitErrorResponse(HttpStatusCode.Forbidden, 'Git push is disabled for this resource');
  }

  const size = request.headers.get(HttpHeader.ContentLength);

  if (isPush && size !== null && Number(size) > policy.maxPushBytes) {
    return gitErrorResponse(HttpStatusCode.PayloadTooLarge, 'Git push exceeds the transfer limit');
  }

  const transfer = await openManagedGitTransfer({
    configuration,
    workspaceId: work.workspaceId,
    workId: work.workId,
    token,
    maxConcurrentRequests: policy.maxConcurrentRequests,
    maxSessionBytes: policy.maxSessionTransferBytes,
  });

  return await forwardGit({
    request,
    operation,
    url,
    credential: resource.token,
    transfer,
    allowedRefs: policy.allowedPushRefs,
    maxBytes: policy.maxPushBytes,
  });
}

export function createManagedGitHandler(input: GitHandlerInput): RequestHandler {
  return async (request) => {
    if (!new URL(request.url).pathname.startsWith('/__mechane/git/')) {
      return null;
    }

    const operation = readGitOperation({ request });

    if (Option.isNone(operation)) {
      return gitErrorResponse(HttpStatusCode.BadRequest, 'Invalid Git request');
    }

    try {
      return await serveGit({ ...input, request, operation: operation.value });
    } catch (failure) {
      if (failure instanceof GitPushRejected) {
        return gitErrorResponse(failure.status, failure.reason);
      }

      if (failure instanceof ManagedStoreError || failure instanceof ManagedHttpError) {
        return gitErrorResponse(failure.status, failure.message);
      }

      return gitErrorResponse(HttpStatusCode.BadGateway, 'Git transfer unavailable');
    }
  };
}

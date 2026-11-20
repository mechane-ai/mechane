import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { managedWorkspaceId } from '@mechane/managed-protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { ManagedHttpError } from './http-error.ts';

type AuthenticateWorker = { readonly request: Request; readonly store: ControlStore; readonly isToolResult: boolean };

export function requireWorkerWorkspace(request: Request, workspaceId: string): void {
  const selected = request.headers.get('anthropic-workspace-id');
  const publicId = managedWorkspaceId({ workspaceId });

  if (selected !== null && selected !== publicId) {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Workspace is not accessible');
  }
}

export function workerBearer(request: Request): string {
  if (request.headers.has(HttpHeader.ApiKey) && request.headers.has(HttpHeader.Authorization)) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Use a single API credential');
  }

  const authorization = request.headers.get(HttpHeader.Authorization) ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length);
}

function workerPurpose(isToolResult: boolean) {
  if (isToolResult) {
    return 'result';
  }

  return 'access';
}

export async function authenticateManagedResourceWorker({ store, request, isToolResult }: AuthenticateWorker) {
  const token = workerBearer(request);

  if (!token.startsWith('sk-ant-req-')) {
    return null;
  }

  const purpose = workerPurpose(isToolResult);
  const caller = await store.managed.worker.tokenScope({ token, purpose });

  if (caller === null) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Invalid or expired work credential');
  }

  requireWorkerWorkspace(request, caller.workspaceId);

  const scope: ManagedScope = { workspaceId: caller.workspaceId, principalId: caller.principalId, isAdmin: false };

  return { workspaceId: caller.workspaceId, sessionId: caller.sessionId, leaseId: caller.leaseId, scope };
}

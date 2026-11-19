import type { ControlStore } from '@mechane/control-store';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { ExecutionEnvironment } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { requireWorkerWorkspace, workerBearer } from './work-auth.ts';

export async function installedCommandEnvironment(input: {
  readonly store: ControlStore;
  readonly request: Request;
  readonly sessionId: string;
}): Promise<Response> {
  const { request, sessionId, store } = input;

  if (request.method !== HttpMethod.Get) {
    throw new ManagedHttpError(HttpStatusCode.MethodNotAllowed, 'Use GET for the command environment');
  }

  const token = workerBearer(request);

  if (!token.startsWith('sk-ant-req-')) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'An installed work credential is required');
  }

  const { workspaceId, environment } = await store.managed.installed.commandAccess.resolve({ sessionId, token });

  requireWorkerWorkspace(request, workspaceId);

  const payload = Schema.encodeSync(ExecutionEnvironment)(environment);

  return Response.json(payload, { headers: { [HttpHeader.CacheControl]: 'no-store' } });
}

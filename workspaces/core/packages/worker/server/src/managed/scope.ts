import type { ManagedScope } from '@mechane/control-store';
import { managedWorkerAccess } from '@mechane/managed-protocol';
import type { ManagedHttpRoute } from '@mechane/managed-protocol';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import type { ManagedRequest } from './types.ts';
import { managedBody } from './wire.ts';
import { authenticateManagedResourceWorker } from './work-auth.ts';

const WorkerResults = Schema.Array(
  Schema.Struct({ type: Schema.Literals(['user.tool_result', 'user.custom_tool_result']) }),
);

type Base = Omit<ManagedRequest, 'scope' | 'workerSession' | 'body'>;

type ScopedInput = {
  readonly base: Base;
  readonly route: ManagedHttpRoute;
  readonly authenticate: () => Promise<ManagedScope>;
};

export async function scopedManagedRequest({ base, route, authenticate }: ScopedInput): Promise<ManagedRequest> {
  const { request, operation, params, store } = base;
  const browser = new URL(request.url).pathname.startsWith('/console-api/');

  if (!browser) {
    const access = managedWorkerAccess({ operation });
    const worker = await authenticateManagedResourceWorker({ store, request, isToolResult: access === 'tool_result' });

    if (worker !== null) {
      switch (access) {
        case 'session_read':
        case 'tool_result':
          if (params['session_id'] !== worker.sessionId) {
            throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Work credential cannot access this session');
          }

          break;
        case 'memory':
        case 'skill':
        case 'file':
          break;
        case 'work':
        case 'denied':
          throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Work credential cannot access this operation');
      }

      const body = await managedBody(route, request);

      if (access === 'tool_result' && !Schema.is(WorkerResults)(body['events'])) {
        throw new ManagedHttpError(HttpStatusCode.Forbidden, 'A session worker may only submit tool results');
      }

      const { scope, ...workerSession } = worker;

      return { ...base, scope, workerSession, body };
    }
  }

  const scope = await authenticate();

  return { ...base, scope, body: await managedBody(route, request) };
}

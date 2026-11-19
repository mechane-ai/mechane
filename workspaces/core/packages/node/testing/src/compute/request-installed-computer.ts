import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { installedComputerPath } from '@mechane/sandbox-wire';
import type { ManagedContext } from '../managed-context.ts';

const OPERATOR_REQUEST_TIMEOUT_MS = 30_000;

type ComputerRequest = {
  readonly path: string;
  readonly method?: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
};

export async function requestInstalledComputer(
  { stack, account, session }: ManagedContext,
  input: ComputerRequest,
): Promise<Response> {
  const prefix = installedComputerPath({ sessionId: session.id, resource: '' });

  if (!input.path.startsWith('/')) {
    throw new Error('An installed computer request needs an absolute resource path');
  }

  const url = new URL(installedComputerPath({ sessionId: session.id, resource: input.path.slice(1) }), stack.origin);

  if (url.origin !== stack.origin.origin || !url.pathname.startsWith(prefix)) {
    throw new Error('An installed computer request cannot leave its session');
  }

  return await fetch(url, {
    method: input.method ?? HttpMethod.Get,
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(input.body),
    signal: input.signal ?? AbortSignal.timeout(OPERATOR_REQUEST_TIMEOUT_MS),
    redirect: 'error',
  });
}

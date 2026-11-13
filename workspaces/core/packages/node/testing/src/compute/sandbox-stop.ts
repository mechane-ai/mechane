import { HttpHeader, HttpMethod } from '@mechane/records';
import {
  SandboxServiceIdentity,
  sandboxStopPath,
  sandboxStopReadPath,
  SandboxStopReceipt,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { MechContext } from '../types.ts';

const REQUEST_TIMEOUT_MS = 30_000;

type StopRequestInput = MechContext & { readonly operationId?: SandboxStopReceipt['operationId'] };

type StopRouteInput = {
  readonly identity: SandboxServiceIdentity;
  readonly operationId: SandboxStopReceipt['operationId'] | undefined;
};

type StopRoute = { readonly path: string; readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post };

export async function requestSandboxStop(input: StopRequestInput): Promise<SandboxStopReceipt> {
  const sandbox = input.stack.sandbox;

  if (sandbox === undefined) {
    throw new Error('The scenario requires the sandbox service');
  }

  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)({
    workspaceId: input.account.workspaceId,
    mechId: input.mechId,
  });

  const route = stopRoute({ identity, operationId: input.operationId });

  const response = await fetch(new URL(route.path, sandbox.origin), {
    method: route.method,
    headers: { [HttpHeader.Authorization]: `Bearer ${sandbox.bearer}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Sandbox stop returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(SandboxStopReceipt)(await response.json());
}

function stopRoute({ identity, operationId }: StopRouteInput): StopRoute {
  if (operationId === undefined) {
    return { path: sandboxStopPath(identity), method: HttpMethod.Post };
  }

  return { path: sandboxStopReadPath({ ...identity, operationId }), method: HttpMethod.Get };
}

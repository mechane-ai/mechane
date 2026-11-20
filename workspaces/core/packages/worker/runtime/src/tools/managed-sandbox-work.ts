import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { MANAGED_WORK_PATH, ManagedSandboxWorkAction, ManagedWorkerClaim } from '@mechane/sandbox-wire';
import type { ManagedWorkerClaimWire, ManagedWorkerSession } from '@mechane/sandbox-wire';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Redacted, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';

type Connection = Pick<RuntimeConfiguration, 'sandbox'>;
type Session = typeof ManagedWorkerSession.Type & { readonly workspaceId: string };
type Allocation = Session & { readonly generation: number };
type Action = (typeof ManagedSandboxWorkAction)[keyof typeof ManagedSandboxWorkAction];

type Command =
  | Session
  | (Allocation & { readonly action: Action })
  | (Allocation & ManagedWorkerClaimWire & { readonly action: Action });

type RequestInput = Connection & { readonly method: HttpMethod; readonly command: Command };

export class ManagedSandboxResponseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Managed sandbox request returned HTTP ${status}`);

    this.name = 'ManagedSandboxResponseError';
    this.status = status;
  }
}

async function requestManagedWorkspace({ sandbox, method, command }: RequestInput): Promise<number> {
  const url = new URL(MANAGED_WORK_PATH, sandbox.origin);
  const bearer = Redacted.value(sandbox.bearer);

  const response = await fetch(url, {
    method,
    redirect: 'manual',
    headers: { [HttpHeader.Authorization]: `Bearer ${bearer}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(command),
  });

  await response.body?.cancel();

  return response.status;
}

async function deliverManagedAction(input: RequestInput, expected: HttpStatusCode): Promise<void> {
  const status = await requestManagedWorkspace(input);

  if (status !== expected) {
    throw new ManagedSandboxResponseError(status);
  }
}

export async function startManagedSandboxWorker({
  sandbox,
  workspaceId,
  generation,
  ...claim
}: Connection & Allocation & ManagedWorkerClaim): Promise<void> {
  const encoded = Schema.encodeSync(ManagedWorkerClaim)(claim);
  const command = { workspaceId, generation, ...encoded, action: ManagedSandboxWorkAction.Start };

  await deliverManagedAction({ sandbox, command, method: HttpMethod.Post }, HttpStatusCode.Accepted);
}

export async function touchManagedSandboxWorker({ sandbox, ...allocation }: Connection & Allocation): Promise<void> {
  const command = { ...allocation, action: ManagedSandboxWorkAction.Touch };

  await deliverManagedAction({ sandbox, command, method: HttpMethod.Post }, HttpStatusCode.NoContent);
}

export async function releaseManagedSandboxWorker({ sandbox, ...allocation }: Connection & Allocation): Promise<void> {
  const command = { ...allocation, action: ManagedSandboxWorkAction.Release };

  await deliverManagedAction({ sandbox, command, method: HttpMethod.Post }, HttpStatusCode.NoContent);
}

const DELETE_SLICE = Duration.seconds(10);
const DELETE_RECHECK = Duration.millis(250);

async function eraseWorkspaceSlice(input: RequestInput): Promise<boolean> {
  const status = await requestManagedWorkspace(input);

  if (status === HttpStatusCode.Accepted) {
    return false;
  }

  if (status !== HttpStatusCode.NoContent) {
    throw new ManagedSandboxResponseError(status);
  }

  return true;
}

export async function destroySessionWorkspace({ sandbox, ...command }: Connection & Session): Promise<boolean> {
  const deadline = DateTime.addDuration(DateTime.nowUnsafe(), DELETE_SLICE);
  const request = { sandbox, method: HttpMethod.Delete, command };

  while (!(await eraseWorkspaceSlice(request))) {
    if (DateTime.isGreaterThanOrEqualTo(DateTime.nowUnsafe(), deadline)) {
      return false;
    }

    await waitFor({ span: DELETE_RECHECK });
  }

  return true;
}

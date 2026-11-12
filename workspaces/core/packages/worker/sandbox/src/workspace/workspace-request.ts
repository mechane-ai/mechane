import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { guestWorkspacePath } from '@mechane/sandbox-wire';
import type { WorkspaceStep } from '@mechane/sandbox-wire';
import { Duration, Option, Result } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { WorkspaceTransferFailed, WorkspaceTransferPhase } from '../errors.ts';
import type { GuestConnection, MachineIdInput } from '../types.ts';
import { observeWorkspaceTransfer } from './observe-workspace-transfer.ts';

type WorkspaceRequestInput = {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  /** Absent when the operation addresses the complete generation. */
  readonly part: Option.Option<number>;
  readonly init: RequestInit;
  readonly lease: Option.Option<number>;
};

/** Sends one bounded workspace request and preserves a guest failure as a tagged transfer error. */
export async function workspaceRequest({
  guest,
  machineId,
  generation,
  step,
  part,
  init,
  lease,
}: WorkspaceRequestInput): Promise<Response> {
  const path = guestWorkspacePath({ machineId, generation, step, part });
  const timeoutMillis = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeoutMillis);
  const headers = new Headers(init.headers);

  if (Option.isSome(lease)) {
    const value = String(lease.value);

    headers.set(HttpHeader.MechaneCheckpointLease, value);
  }

  const response = await observeWorkspaceTransfer({
    generation,
    step,
    part,
    phase: WorkspaceTransferPhase.Request,
    run: () => guest.fetch({ path, init: { ...init, headers, signal } }),
  });

  switch (response.status) {
    case HttpStatusCode.Ok:
    case HttpStatusCode.NoContent:
      return response;
    default:
      return await failedWorkspaceResponse({ response, generation, step, part });
  }
}

type FailedWorkspaceResponseInput = Pick<WorkspaceRequestInput, 'generation' | 'step' | 'part'> & {
  readonly response: Response;
};

async function failedWorkspaceResponse({
  response,
  generation,
  step,
  part,
}: FailedWorkspaceResponseInput): Promise<Response> {
  const fail: () => Promise<never> = async () => {
    const reason = await response.text();
    const cause = new WorkspaceTransferFailed({ generation, step, reason });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  };

  return await observeWorkspaceTransfer({
    generation,
    step,
    part,
    phase: WorkspaceTransferPhase.ResponseBody,
    run: fail,
  });
}

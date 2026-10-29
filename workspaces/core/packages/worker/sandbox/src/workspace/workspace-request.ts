import { HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { guestWorkspacePath } from '@mechane/sandbox-wire';
import type { WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Result } from 'effect';
import type { Option } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { GuestConnection, MachineIdInput } from '../types.ts';

type WorkspaceRequestInput = {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  /** Absent when the operation addresses the complete generation. */
  readonly part: Option.Option<number>;
  readonly init: RequestInit;
};

/** Sends one bounded workspace request and preserves a guest failure as a tagged transfer error. */
export async function workspaceRequest({
  guest,
  machineId,
  generation,
  step,
  part,
  init,
}: WorkspaceRequestInput): Promise<Response> {
  const path = guestWorkspacePath({ machineId, generation, step, part });
  const timeoutMillis = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeoutMillis);
  const promise = guest.fetch({ path, init: { ...init, signal } });
  const sent = await capturePromise({ promise });

  const transferFailure: (cause: unknown) => WorkspaceTransferFailed = (cause) => {
    const reason = String(cause);

    return new WorkspaceTransferFailed({ generation, step, reason });
  };

  const checked = Result.mapError(sent, transferFailure);
  const response = Result.getOrThrow(checked);

  switch (response.status) {
    case HttpStatusCode.Ok:
    case HttpStatusCode.NoContent:
      return response;
    default:
      return await failedWorkspaceResponse({ response, generation, step });
  }
}

type FailedWorkspaceResponseInput = Pick<WorkspaceRequestInput, 'generation' | 'step'> & {
  readonly response: Response;
};

async function failedWorkspaceResponse({
  response,
  generation,
  step,
}: FailedWorkspaceResponseInput): Promise<Response> {
  const reason = await response.text();
  const cause = new WorkspaceTransferFailed({ generation, step, reason });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}

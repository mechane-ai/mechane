import { Bytes, BYTES_PER_MEBIBYTE, HttpMethod, HttpStatusCode, MachineId } from '@mechane/records';
import { guestProcessesPath, ProcessSummaries } from '@mechane/sandbox-wire';
import { Duration, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import type { GuestConnection } from '../types.ts';

type ListGuestProcessesInput = { readonly machineId: MachineId; readonly guest: GuestConnection };

class ProcessListFailed extends Schema.TaggedError<ProcessListFailed>()('ProcessListFailed', {
  machineId: MachineId,
  status: Schema.Int,
}) {}

/** The guest lists bounded identities and states; logs are fetched only by an individual process read. */
export async function listGuestProcesses({ guest, machineId }: ListGuestProcessesInput): Promise<ProcessSummaries> {
  const path = guestProcessesPath({ machineId });
  const timeout = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeout);
  const response = await guest.fetch({ path, init: { method: HttpMethod.Get, signal } });

  if (response.status !== HttpStatusCode.Ok) {
    const cause = new ProcessListFailed({ machineId, status: response.status });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  const maximumBytes = Bytes.make(BYTES_PER_MEBIBYTE);
  const bounded = boundGuestResponse({ response, maximumBytes });
  const text = await bounded.text();
  const codec = Schema.fromJsonString(ProcessSummaries);
  const result = Schema.decodeUnknownResult(codec)(text);
  const summaries = Result.getOrThrow(result);

  if (summaries.some((summary) => summary.handle.machineId !== machineId)) {
    const cause = new ProcessListFailed({ machineId, status: HttpStatusCode.Conflict });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  return summaries;
}

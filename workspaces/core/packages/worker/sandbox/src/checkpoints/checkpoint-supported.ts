import { Bytes, BYTES_PER_KIBIBYTE, HttpMethod, HttpStatusCode, MachineId } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { GuestCapabilities, guestCapabilitiesPath, WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import type { GuestConnection, MachineIdInput } from '../types.ts';

type CheckpointSupportedInput = MachineIdInput & { readonly guest: GuestConnection; readonly generation: RecordId };

/** Only the released bare 404 from a healthy guest selects the bodyless archive protocol. */
export async function checkpointSupported({
  guest,
  machineId,
  generation,
}: CheckpointSupportedInput): Promise<boolean> {
  const identity = MachineId.make(machineId);
  const path = guestCapabilitiesPath({ machineId: identity });
  const timeout = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeout);
  const promise = guest.fetch({ path, init: { method: HttpMethod.Get, signal } });
  const sent = await capturePromise({ promise });

  const failure: (cause: unknown) => WorkspaceTransferFailed = (cause) => {
    const reason = String(cause);

    return new WorkspaceTransferFailed({ generation, step: WorkspaceStep.Checkpoint, reason });
  };

  const checkedResponse = Result.mapError(sent, failure);
  const response = Result.getOrThrow(checkedResponse);
  const maximumBytes = Bytes.make(BYTES_PER_KIBIBYTE);
  const bounded = boundGuestResponse({ response, maximumBytes });
  const body = bounded.text();
  const read = await capturePromise({ promise: body });
  const checkedBody = Result.mapError(read, failure);
  const text = Result.getOrThrow(checkedBody);

  if (response.status === HttpStatusCode.NotFound && text === '' && (await guest.health({ machineId }))) {
    return false;
  }

  if (response.status !== HttpStatusCode.Ok) {
    const cause = failure(`guest capability request returned ${response.status}`);
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  const schema = Schema.fromJsonString(GuestCapabilities);
  const decoded = Schema.decodeUnknownResult(schema)(text);
  const checked = Result.mapError(decoded, failure);
  const capabilities = Result.getOrThrow(checked);

  return capabilities.isCheckpointSupported;
}

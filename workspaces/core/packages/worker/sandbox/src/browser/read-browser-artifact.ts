import { Bytes, HttpMethod, HttpStatusCode } from '@mechane/records';
import {
  BROWSER_ARTIFACT_PART_BYTES,
  BrowserArtifactPart,
  guestBrowserArtifactPath,
  SandboxBrowserArtifactAnswer,
} from '@mechane/sandbox-wire';
import type { BrowserArtifactPartRequest } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';

type ReadBrowserArtifactInput = ProviderStepInput & MachineIdInput & { readonly request: BrowserArtifactPartRequest };
const BASE64_RESPONSE_MULTIPLIER = 2;
const ARTIFACT_RESPONSE_MAX_BYTES = Bytes.make(BROWSER_ARTIFACT_PART_BYTES * BASE64_RESPONSE_MULTIPLIER);

/** Evidence transfer never allocates a machine or recreates an artifact whose original guest disappeared. */
export async function readBrowserArtifact({
  store,
  provider,
  machineId,
  request,
}: ReadBrowserArtifactInput): Promise<SandboxBrowserArtifactAnswer> {
  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== machineId) {
    return SandboxBrowserArtifactAnswer.cases.Missing.make({});
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    return SandboxBrowserArtifactAnswer.cases.Missing.make({});
  }

  const path = guestBrowserArtifactPath({ machineId, ...request });
  const timeout = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeout);
  const fetch = guest.value.fetch({ path, init: { method: HttpMethod.Get, signal } });
  const received = await capturePromise({ promise: fetch });

  if (Result.isFailure(received)) {
    return SandboxBrowserArtifactAnswer.cases.Failed.make({
      reason: 'the original browser artifact could not be reached',
    });
  }

  if (received.success.status === HttpStatusCode.NotFound) {
    return SandboxBrowserArtifactAnswer.cases.Missing.make({});
  }

  if (received.success.status !== HttpStatusCode.Ok) {
    return SandboxBrowserArtifactAnswer.cases.Failed.make({ reason: 'the guest refused the browser artifact part' });
  }

  const response = boundGuestResponse({ response: received.success, maximumBytes: ARTIFACT_RESPONSE_MAX_BYTES });
  const read = response.text();
  const body = await capturePromise({ promise: read });

  if (Result.isFailure(body)) {
    return SandboxBrowserArtifactAnswer.cases.Failed.make({
      reason: 'the browser artifact part exceeded its response limit',
    });
  }

  const codec = Schema.fromJsonString(BrowserArtifactPart);
  const part = Schema.decodeUnknownResult(codec)(body.success);

  if (Result.isFailure(part)) {
    return SandboxBrowserArtifactAnswer.cases.Failed.make({
      reason: 'the guest returned an invalid browser artifact part',
    });
  }

  if (part.success.artifact.artifactId !== request.artifactId || part.success.offset !== request.offset) {
    return SandboxBrowserArtifactAnswer.cases.Failed.make({
      reason: 'the guest returned another browser artifact part',
    });
  }

  return SandboxBrowserArtifactAnswer.cases.Ready.make({ part: part.success });
}

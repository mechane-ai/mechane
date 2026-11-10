import { Bytes, HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { MachineId } from '@mechane/records';
import {
  BROWSER_RESPONSE_MAX_BYTES,
  BrowserProgress,
  BrowserRequest,
  BrowserResponse,
  guestBrowserPath,
} from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import type { GuestConnection } from '../types.ts';

const BROWSER_GUEST_TIMEOUT = Duration.minutes(2);

type BrowserGuestInput = {
  readonly machineId: MachineId;
  readonly guest: GuestConnection;
  readonly request: BrowserRequest;
};

/** The guest journals every mutation by request ID before acting; transport retries rejoin that journal. */
export async function browserGuest({ guest, machineId, request }: BrowserGuestInput): Promise<BrowserProgress> {
  const path = guestBrowserPath({ machineId });
  const codec = Schema.fromJsonString(BrowserRequest);
  const body = Schema.encodeSync(codec)(request);
  const timeout = Duration.toMillis(BROWSER_GUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);

  const promise = guest.fetch({
    path,
    init: { method: HttpMethod.Post, signal, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });

  const sent = await capturePromise({ promise });

  if (Result.isFailure(sent)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the browser response was interrupted; retry this request ID to reconcile its receipt',
    });
  }

  if (sent.success.status === HttpStatusCode.NotFound) {
    const responseBody = Option.fromNullOr(sent.success.body);

    if (Option.isSome(responseBody)) {
      await responseBody.value.cancel();
    }

    return BrowserProgress.cases.Failed.make({
      reason:
        'this guest does not support browser actions; explicitly retire or restart its environment before starting new browser work',
    });
  }

  if (sent.success.status === HttpStatusCode.NoContent) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the guest is finishing a workspace operation before admitting this browser request',
    });
  }

  const maximumBytes = Bytes.make(BROWSER_RESPONSE_MAX_BYTES);
  const response = boundGuestResponse({ response: sent.success, maximumBytes });
  const read = response.text();
  const received = await capturePromise({ promise: read });

  if (Result.isFailure(received)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the browser response could not be read within its byte limit',
    });
  }

  if (response.status !== HttpStatusCode.Ok) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: `the guest refused browser request ${request.requestId} with HTTP ${response.status}`,
    });
  }

  const responseCodec = Schema.fromJsonString(BrowserResponse);
  const decoded = Schema.decodeUnknownResult(responseCodec)(received.success);

  if (Result.isFailure(decoded) || decoded.success.requestId !== request.requestId) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the guest returned an invalid browser receipt',
    });
  }

  return BrowserProgress.cases.Ready.make({ machineId, response: decoded.success });
}

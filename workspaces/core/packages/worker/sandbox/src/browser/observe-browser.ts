import { Bytes, HttpMethod, HttpStatusCode } from '@mechane/records';
import { BrowserProgress, BrowserReceipt, BrowserRequest, guestBrowserReceiptPath } from '@mechane/sandbox-wire';
import type { BrowserRequestId } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import type { ProviderStepInput } from '../types.ts';
import { browserProgress, completedBrowserProgress } from './browser-progress.ts';

const BROWSER_RECEIPT_MAX_BYTES = Bytes.make(2_097_152);
type ObserveBrowserInput = ProviderStepInput & { readonly requestId: BrowserRequestId };
type MissingReceiptInput = Pick<ObserveBrowserInput, 'store' | 'requestId'> & { readonly reason: string };

/** Receipt observation contacts only the original machine and never sends an action or allocates compute. */
export async function observeBrowser({ store, provider, requestId }: ObserveBrowserInput): Promise<BrowserProgress> {
  const call = store.requiredBrowserCall({ requestId });
  const completed = browserProgress({ call });

  const canReconcile = Option.exists(call.failure, (failure) => failure.isUncertain);

  if (Option.isSome(completed) && !canReconcile) {
    return completed.value;
  }

  if (Option.isNone(call.machineId)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original browser action has not been assigned to a machine',
    });
  }

  const machineId = call.machineId.value;
  const guest = await connectLiveMachine({ store, provider, machineId });

  if (Option.isNone(guest)) {
    return missingReceipt({
      store,
      requestId,
      reason: 'the original browser machine was lost; its action was not replayed',
    });
  }

  const path = guestBrowserReceiptPath({ machineId, requestId });
  const timeout = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeout);
  const request = guest.value.fetch({ path, init: { method: HttpMethod.Get, signal } });
  const response = await capturePromise({ promise: request });

  if (Result.isFailure(response)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original browser receipt could not be reached yet',
    });
  }

  if (response.success.status === HttpStatusCode.NotFound) {
    const body = Option.fromNullOr(response.success.body);

    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    return missingReceipt({
      store,
      requestId,
      reason:
        'this guest does not support browser receipt lookup; the original action was not replayed; explicitly retire or restart its environment before new browser work',
    });
  }

  if (response.success.status !== HttpStatusCode.Ok) {
    const body = Option.fromNullOr(response.success.body);

    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original browser receipt could not be read yet',
    });
  }

  const bounded = boundGuestResponse({ response: response.success, maximumBytes: BROWSER_RECEIPT_MAX_BYTES });
  const reading = bounded.text();
  const read = await capturePromise({ promise: reading });

  if (Result.isFailure(read)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original browser receipt response was interrupted',
    });
  }

  const codec = Schema.fromJsonString(BrowserReceipt);
  const decoded = Schema.decodeUnknownResult(codec)(read.success);

  if (Result.isFailure(decoded)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original browser receipt response could not be decoded',
    });
  }

  const receipt = decoded.success;

  if (BrowserReceipt.guards.Missing(receipt)) {
    return missingReceipt({
      store,
      requestId,
      reason: 'the original guest has no browser receipt; the action was not replayed',
    });
  }

  const requestCodec = Schema.fromJsonString(BrowserRequest);
  const expected = Schema.encodeSync(requestCodec)(call.request);
  const observed = Schema.encodeSync(requestCodec)(receipt.request);

  if (expected !== observed) {
    return missingReceipt({
      store,
      requestId,
      reason: 'the original guest receipt differs from its immutable browser request',
    });
  }

  if (BrowserReceipt.guards.Pending(receipt)) {
    return BrowserProgress.cases.Pending.make({
      isDispatchRequired: false,
      reason: 'the original guest is still completing this browser action',
    });
  }

  if (BrowserReceipt.guards.Uncertain(receipt)) {
    return missingReceipt({ store, requestId, reason: receipt.reason });
  }

  if (receipt.response.requestId !== requestId) {
    return missingReceipt({
      store,
      requestId,
      reason: 'the original guest returned another browser response identity',
    });
  }

  store.saveBrowserResponse({ machineId, response: receipt.response });

  const recorded = store.requiredBrowserCall({ requestId });

  return completedBrowserProgress({ call: recorded });
}

function missingReceipt({ store, requestId, reason }: MissingReceiptInput): BrowserProgress {
  store.failBrowserCall({ requestId, reason, isUncertain: true });

  return BrowserProgress.cases.Uncertain.make({ reason });
}

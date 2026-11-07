import { BROWSER_RESPONSE_MAX_BYTES, BrowserResponse, BrowserResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

const BrowserResponseJson = Schema.fromJsonString(BrowserResponse);

type BoundBrowserResponseInput = { readonly response: BrowserResponse };

/** A preview and Unicode accessibility labels share the same durable-response byte budget. */
export function boundBrowserResponse({ response }: BoundBrowserResponseInput): BrowserResponse {
  if (!BrowserResult.guards.Observation(response.result)) {
    return response;
  }

  const observation = response.result;
  const empty = { ...response, result: { ...observation, targets: [], isTruncated: false } };
  const serialize = Schema.encodeSync(BrowserResponseJson);
  const encoded = serialize(empty);
  const budgetBytes = BROWSER_RESPONSE_MAX_BYTES - Buffer.byteLength(encoded, 'utf8');
  const state = { usedBytes: 0, isFull: false };

  const targets = observation.targets.filter((target) => {
    if (state.isFull) {
      return false;
    }

    const serialized = JSON.stringify(target);
    const requiredBytes = Buffer.byteLength(serialized, 'utf8') + 1;

    if (state.usedBytes + requiredBytes > budgetBytes) {
      state.isFull = true;

      return false;
    }

    state.usedBytes += requiredBytes;

    return true;
  });

  const isTruncated = observation.isTruncated || targets.length < observation.targets.length;

  return { ...response, result: { ...observation, targets, isTruncated } };
}

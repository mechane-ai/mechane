import { HttpHeader, HttpMethod } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { SLACK_REQUEST_TIMEOUT } from './constants.ts';
import { SlackHistory } from './schemas.ts';
import { slackAuthorization } from './slack-authorization.ts';
import { slackHistoryUrl } from './slack-history-url.ts';
import type { SlackHistoryPageInput } from './types.ts';

/** Reads one bounded history page without following redirects. */
export async function readSlackHistoryPage({
  token,
  ...input
}: SlackHistoryPageInput): Promise<Option.Option<SlackHistory>> {
  const url = slackHistoryUrl({ ...input, token });
  const headers = { [HttpHeader.Authorization]: slackAuthorization({ token }) };
  const timeout = Duration.toMillis(SLACK_REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const promise = fetch(url, { method: HttpMethod.Get, headers, signal, redirect: 'manual' });
  const response = await capturePromise({ promise });

  if (Result.isFailure(response) || !response.success.ok) {
    return Option.none();
  }

  const bodyPromise = response.success.text();
  const serialized = await capturePromise({ promise: bodyPromise });

  if (Result.isFailure(serialized)) {
    return Option.none();
  }

  const wire = Schema.fromJsonString(SlackHistory);
  const decoded = Schema.decodeUnknownResult(wire)(serialized.success);

  return Result.getSuccess(decoded);
}

import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { SlackChannelId } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { classifySlackPost } from './classify-slack-post.ts';
import { SlackPostResult, SlackResponse } from './schemas.ts';

type ReadSlackPostBodyInput = { readonly response: Response; readonly channelId: SlackChannelId };

type ReadSlackPostResultInput = {
  /** Absent when transport failed before receiving a response. */
  readonly response: Option.Option<Response>;
  readonly channelId: SlackChannelId;
};

const SLACK_RETRY_SECONDS = 60;

/** Interprets provider responses while preserving ambiguity after transport failures. */
export async function readSlackPostResult({ response, channelId }: ReadSlackPostResultInput): Promise<SlackPostResult> {
  if (Option.isNone(response)) {
    return SlackPostResult.cases.Uncertain.make({ reason: 'transport_failed' });
  }

  if (response.value.status === HttpStatusCode.TooManyRequests) {
    const header = response.value.headers.get(HttpHeader.RetryAfter);
    const retry = Number(header);
    const bounded = Option.liftPredicate(retry, Number.isFinite);
    const seconds = Option.getOrElse(bounded, () => SLACK_RETRY_SECONDS);
    const retryAfterSeconds = Math.max(SLACK_RETRY_SECONDS, seconds);
    const retryAfter = Duration.seconds(retryAfterSeconds);

    return SlackPostResult.cases.Deferred.make({ retryAfter });
  }

  if (!response.value.ok) {
    return SlackPostResult.cases.Uncertain.make({ reason: 'http_failed' });
  }

  return await readSlackPostBody({ response: response.value, channelId });
}

async function readSlackPostBody({ response, channelId }: ReadSlackPostBodyInput): Promise<SlackPostResult> {
  const promise = response.text();
  const serialized = await capturePromise({ promise });

  if (Result.isFailure(serialized)) {
    return SlackPostResult.cases.Uncertain.make({ reason: 'response_unreadable' });
  }

  const wire = Schema.fromJsonString(SlackResponse);
  const decoded = Schema.decodeUnknownResult(wire)(serialized.success);

  if (Result.isFailure(decoded)) {
    return SlackPostResult.cases.Uncertain.make({ reason: 'response_invalid' });
  }

  return classifySlackPost({ reply: decoded.success, channelId });
}

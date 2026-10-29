import { SlackEnvelope, verifySlackSignature } from '@mechane/integrations';
import { RequestInvalid } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { DateTime, Effect, Option, Result, Schema } from 'effect';
import type { Redacted } from 'effect';
import { readSlackBody } from './read-slack-body.ts';

type ReadSignedSlackEnvelopeInput = { readonly request: Request; readonly signingSecret: Redacted.Redacted };

/** Verifies a bounded raw body before decoding the Slack envelope. */
export const readSignedSlackEnvelope = Effect.fn('readSignedSlackEnvelope')(function* ({
  request,
  signingSecret,
}: ReadSignedSlackEnvelopeInput): Effect.fn.Return<Option.Option<SlackEnvelope>, RequestInvalid> {
  const body = yield* Effect.tryPromise({
    try: () => readSlackBody({ request }),
    catch: () => new RequestInvalid({ reason: 'Slack event body could not be read' }),
  });

  const timestampHeader = request.headers.get(HttpHeader.SlackRequestTimestamp);
  const signatureHeader = request.headers.get(HttpHeader.SlackSignature);
  const timestamp = Option.fromNullOr(timestampHeader);
  const signature = Option.fromNullOr(signatureHeader);
  const now = DateTime.nowUnsafe();

  const isSigned = yield* Effect.tryPromise({
    try: () => verifySlackSignature({ body, timestamp, signature, signingSecret, now }),
    catch: () => new RequestInvalid({ reason: 'Slack event signature could not be verified' }),
  });

  if (!isSigned) {
    return Option.none();
  }

  const serialized = new TextDecoder().decode(body);
  const wire = Schema.fromJsonString(SlackEnvelope);
  const decoded = Schema.decodeUnknownResult(wire)(serialized);

  if (Result.isFailure(decoded)) {
    return yield* new RequestInvalid({ reason: 'Slack event envelope is invalid' });
  }

  return Option.some(decoded.success);
});

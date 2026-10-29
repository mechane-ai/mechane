import { detailFailure, ErrorBody } from '@mechane/protocol';
import type { FailureCodec, ServiceFreeCodec } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { AnswerStep } from './constants.ts';
import { OperationFailed, ResponseUnreadable } from './errors.ts';

/** The answer to decode, with its success's schema and the failures its request expects. */
type DecodeAnswerInput<S> = {
  readonly output: S;
  readonly failures: ReadonlyArray<FailureCodec>;
  readonly response: Response;
  readonly url: URL;
};

/** A body an answer carried, the schema it must decode with, and the answer and URL a failure names. */
type DecodeBodyInput<S> = {
  readonly schema: S;
  readonly body: unknown;
  readonly response: Response;
  readonly url: URL;
};

/**
 * Decodes a success body with the operation's output schema, and an error body into an `OperationFailed`. Its failure
 * is the expected one its code names, with its own fields, or an unknown one.
 */
export const decodeAnswer = Effect.fn('decodeAnswer')(function* <S extends ServiceFreeCodec>({
  output,
  failures,
  response,
  url,
}: DecodeAnswerInput<S>): Effect.fn.Return<S['Type'], OperationFailed | ResponseUnreadable> {
  const body = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: (cause) =>
      new ResponseUnreadable({ url, status: response.status, step: AnswerStep.ParseJson, reason: String(cause) }),
  });

  if (!response.ok) {
    const { error } = yield* decodeBody({ schema: ErrorBody, body, response, url });

    const failure = yield* detailFailure({ detail: error, failures }).pipe(
      Effect.mapError(
        (issue) =>
          new ResponseUnreadable({ url, status: response.status, step: AnswerStep.Decode, reason: issue.message }),
      ),
    );

    return yield* new OperationFailed({ family: error.family, message: error.message, failure });
  }

  return yield* decodeBody({ schema: output, body, response, url });
});

/** Decodes a body with its schema; a body the schema refuses is an answer this client cannot read. */
const decodeBody = Effect.fn('decodeBody')(function* <S extends ServiceFreeCodec>({
  schema,
  body,
  response,
  url,
}: DecodeBodyInput<S>): Effect.fn.Return<S['Type'], ResponseUnreadable> {
  return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.mapError(
      (failure) =>
        new ResponseUnreadable({ url, status: response.status, step: AnswerStep.Decode, reason: failure.message }),
    ),
  );
});

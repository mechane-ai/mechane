import type { FailureCodec, ServiceFreeCodec } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { Bytes } from '@mechane/records';
import { Effect, Result, Schema } from 'effect';
import type { Option } from 'effect';
import { AnswerStep } from './constants.ts';
import { decodeAnswer } from './decode-answer.ts';
import { ResponseUnreadable } from './errors.ts';
import type { OperationFailed } from './errors.ts';

type DecodeMediaAnswerInput<S> = {
  readonly output: S;
  readonly mediaType: Schema.Codec<string, string>;
  readonly failures: ReadonlyArray<FailureCodec>;
  readonly response: Response;
  readonly url: URL;
  /** Absent when failure bodies use the client's default response limit; successful media stays streamed. */
  readonly maxResponseBytes: Option.Option<Bytes>;
};

/** The caller owns consumption of a validated media stream after its headers arrive. */
export const decodeMediaAnswer = Effect.fn('decodeMediaAnswer')(function* <S extends ServiceFreeCodec>({
  output,
  mediaType,
  failures,
  response,
  url,
  maxResponseBytes,
}: DecodeMediaAnswerInput<S>): Effect.fn.Return<S['Type'], OperationFailed | ResponseUnreadable> {
  if (!response.ok && response.status !== HttpStatusCode.RangeNotSatisfiable) {
    return yield* decodeAnswer({ output, failures, response, url, maxResponseBytes });
  }

  const type = response.headers.get(HttpHeader.ContentType);
  const checked = Schema.decodeUnknownResult(mediaType)(type);

  if (Result.isFailure(checked)) {
    return yield* new ResponseUnreadable({
      url,
      status: response.status,
      step: AnswerStep.Decode,
      reason: 'media response has an undeclared content type',
    });
  }

  return yield* Schema.decodeUnknownEffect(output)(response).pipe(
    Effect.mapError(
      (failure) =>
        new ResponseUnreadable({ url, status: response.status, step: AnswerStep.Decode, reason: failure.message }),
    ),
  );
});

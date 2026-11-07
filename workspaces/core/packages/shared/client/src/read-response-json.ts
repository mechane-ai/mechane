import type { Bytes } from '@mechane/records';
import { Effect, Option } from 'effect';
import { AnswerStep } from './constants.ts';
import { ResponseUnreadable } from './errors.ts';
import type { RetryAfter } from './retry-after.ts';

type ReadResponseJsonInput = {
  readonly response: Response;
  readonly url: URL;
  /** None keeps the server response unbounded; Some limits bytes before decoding. */
  readonly maxResponseBytes: Option.Option<Bytes>;
  readonly retryAfter: RetryAfter;
};

type ReadInput = { readonly signal: AbortSignal };

/** Reads JSON with a caller's byte limit and releases the body when its request is interrupted. */
export const readResponseJson = Effect.fn('readResponseJson')(function* ({
  response,
  url,
  maxResponseBytes,
  retryAfter,
}: ReadResponseJsonInput): Effect.fn.Return<unknown, ResponseUnreadable> {
  const body = Option.fromNullOr(response.body);

  async function read({ signal }: ReadInput): Promise<unknown> {
    if (Option.isNone(maxResponseBytes) || Option.isNone(body)) {
      return await response.json();
    }

    const received = { bytes: 0 };
    const limit = maxResponseBytes.value;

    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller): void {
        received.bytes += chunk.byteLength;

        if (received.bytes > limit) {
          const failure = new ResponseUnreadable({
            url,
            status: response.status,
            step: AnswerStep.ParseJson,
            reason: 'Response exceeds the requested byte limit',
            retryAfter,
          });

          controller.error(failure);

          return;
        }

        controller.enqueue(chunk);
      },
    });

    const bounded = body.value.pipeThrough(limiter, { signal });
    const limited = new Response(bounded);

    return await limited.json();
  }

  return yield* Effect.tryPromise({
    try: (signal) => read({ signal }),
    catch: (cause) =>
      new ResponseUnreadable({
        url,
        status: response.status,
        step: AnswerStep.ParseJson,
        reason: String(cause),
        retryAfter,
      }),
  });
});

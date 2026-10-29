import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Option, Schema } from 'effect';

const SOURCE_RESPONSE_MAX_BYTES = 2 * BYTES_PER_MEBIBYTE;

class SourceResponseTooLarge extends Schema.TaggedError<SourceResponseTooLarge>()('SourceResponseTooLarge', {}) {}

type BoundSourceResponseInput = { readonly response: Response };

/** Enforces the source response limit while streaming, before JSON parsing can allocate the entire body. */
export function boundSourceResponse({ response }: BoundSourceResponseInput): Response {
  const body = Option.fromNullOr(response.body);

  if (Option.isNone(body)) {
    return response;
  }

  const received = { bytes: 0 };

  const transform: Transformer<Uint8Array, Uint8Array>['transform'] = (chunk, controller) => {
    received.bytes += chunk.byteLength;

    if (received.bytes > SOURCE_RESPONSE_MAX_BYTES) {
      const failure = new SourceResponseTooLarge({});

      controller.error(failure);

      return;
    }

    controller.enqueue(chunk);
  };

  const limiter = new TransformStream<Uint8Array, Uint8Array>({ transform });
  const bounded = body.value.pipeThrough(limiter);

  return new Response(bounded, { status: response.status, headers: response.headers });
}

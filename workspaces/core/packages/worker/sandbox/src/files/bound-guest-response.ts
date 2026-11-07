import type { Bytes } from '@mechane/records';
import { Option, Schema } from 'effect';

type BoundGuestResponseInput = { readonly response: Response; readonly maximumBytes: Bytes };
class GuestResponseTooLarge extends Schema.TaggedError<GuestResponseTooLarge>()('GuestResponseTooLarge', {}) {}

/** Caps encoded bytes before JSON parsing, including oversized guest errors. */
export function boundGuestResponse({ response, maximumBytes }: BoundGuestResponseInput): Response {
  const body = Option.fromNullOr(response.body);

  if (Option.isNone(body)) {
    return response;
  }

  const received = { bytes: 0 };

  const transform: Transformer<Uint8Array, Uint8Array>['transform'] = (chunk, controller) => {
    received.bytes += chunk.byteLength;

    if (received.bytes > maximumBytes) {
      const failure = new GuestResponseTooLarge({});

      controller.error(failure);

      return;
    }

    controller.enqueue(chunk);
  };

  const limiter = new TransformStream<Uint8Array, Uint8Array>({ transform });
  const bounded = body.value.pipeThrough(limiter);

  return new Response(bounded, { status: response.status, headers: response.headers });
}

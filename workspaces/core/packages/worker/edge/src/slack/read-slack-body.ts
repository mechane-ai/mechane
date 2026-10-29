import { RequestInvalid } from '@mechane/protocol';
import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Option } from 'effect';

type ReadSlackBodyInput = { readonly request: Request };

/** Bounds raw request bytes before buffering the body used for signature verification. */
export async function readSlackBody({ request }: ReadSlackBodyInput): Promise<Uint8Array> {
  const body = Option.fromNullOr(request.body);

  if (Option.isNone(body)) {
    return new Uint8Array();
  }

  const received = { bytes: 0 };

  const bound = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller): void {
      received.bytes += chunk.byteLength;

      if (received.bytes > BYTES_PER_MEBIBYTE) {
        const failure = new RequestInvalid({ reason: 'Slack event body exceeds its byte limit' });

        controller.error(failure);

        return;
      }

      controller.enqueue(chunk);
    },
  });

  const bounded = body.value.pipeThrough(bound);
  const response = new Response(bounded);
  const buffer = await response.arrayBuffer();

  return new Uint8Array(buffer);
}

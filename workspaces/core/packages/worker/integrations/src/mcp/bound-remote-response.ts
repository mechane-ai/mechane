import { HttpStatusCode } from '@mechane/records';
import { Option, Schema } from 'effect';
import type { RemoteByteCount } from './types.ts';

class RemoteResponseTooLarge extends Schema.TaggedError<RemoteResponseTooLarge>()('RemoteResponseTooLarge', {}) {}

type BoundRemoteResponseInput = { readonly response: Response; readonly accept: (input: RemoteByteCount) => boolean };

/** The SDK must never see a redirect target because the request can carry an operator credential. */
export async function boundRemoteResponse({ response, accept }: BoundRemoteResponseInput): Promise<Response> {
  if (response.status >= HttpStatusCode.MultipleChoices && response.status < HttpStatusCode.BadRequest) {
    const body = Option.fromNullOr(response.body);

    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    return Response.error();
  }

  return boundResponseBody({ response, accept });
}

function boundResponseBody({ response, accept }: BoundRemoteResponseInput): Response {
  const body = Option.fromNullOr(response.body);

  if (Option.isNone(body)) {
    return response;
  }

  const bound = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller): void {
      if (!accept({ bytes: chunk.byteLength })) {
        const failure = new RemoteResponseTooLarge({});

        controller.error(failure);

        return;
      }

      controller.enqueue(chunk);
    },
  });

  const boundedBody = body.value.pipeThrough(bound);

  return new Response(boundedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

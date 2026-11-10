import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { TOOL_REQUEST_TIMEOUT_MS, TOOL_RESPONSE_MAX_BYTES } from './constants.ts';

export async function readBoundedJson(response: Response, maximumBytes = TOOL_RESPONSE_MAX_BYTES): Promise<unknown> {
  if (response.body === null) {
    throw new Error('The service returned no response body');
  }

  const stream: ReadableStream<unknown> = response.body;
  const reader = stream.getReader();
  const fragments: Array<string> = [];
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
  const bytes = { count: 0 };

  try {
    const current = { chunk: await reader.read() };

    while (!current.chunk.done) {
      const chunk = Schema.decodeUnknownSync(Schema.Uint8Array)(current.chunk.value);
      bytes.count += chunk.byteLength;

      if (bytes.count > maximumBytes) {
        await reader.cancel();

        throw new Error('The service response exceeds the tool limit');
      }

      fragments.push(decoder.decode(chunk, { stream: true }));

      current.chunk = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }

  fragments.push(decoder.decode());

  const body = fragments.join('');

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('The service returned invalid JSON');
  }
}

export async function rejectRedirect(response: Response): Promise<void> {
  if (response.status >= HttpStatusCode.MultipleChoices && response.status < HttpStatusCode.BadRequest) {
    await response.body?.cancel();

    throw new TypeError('Redirects are not allowed for service requests');
  }
}

export function boundedToolFetch(sharedSignal?: AbortSignal): typeof fetch {
  const deadline = AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS);
  const received = { bytes: 0 };

  return async (url, init) => {
    const signals = [deadline];

    if (sharedSignal !== undefined) {
      signals.push(sharedSignal);
    }

    if (init?.signal !== undefined && init.signal !== null) {
      signals.push(init.signal);
    }

    const signal = AbortSignal.any(signals);
    const response = await fetch(url, { ...init, signal, redirect: 'manual' });

    await rejectRedirect(response);

    if (response.body === null) {
      return response;
    }

    const bound = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received.bytes += chunk.byteLength;

        if (received.bytes > TOOL_RESPONSE_MAX_BYTES) {
          controller.error(new Error('The service response exceeds the tool limit'));

          return;
        }

        controller.enqueue(chunk);
      },
    });

    return new Response(response.body.pipeThrough(bound), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

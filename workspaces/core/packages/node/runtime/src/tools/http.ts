import { TOOL_REQUEST_TIMEOUT_MS, TOOL_RESPONSE_MAX_BYTES } from './constants.ts';

export async function readBoundedJson(response: Response, maximumBytes = TOOL_RESPONSE_MAX_BYTES): Promise<unknown> {
  if (response.body === null) {
    throw new Error('The service returned no response body');
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  const bytes = { count: 0 };

  try {
    const current = { chunk: await reader.read() };

    while (!current.chunk.done) {
      bytes.count += current.chunk.value.byteLength;

      if (bytes.count > maximumBytes) {
        await reader.cancel();

        throw new Error('The service response exceeds the tool limit');
      }

      chunks.push(current.chunk.value);

      current.chunk = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks);

  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error('The service returned invalid JSON');
  }
}

export function boundedToolFetch(): typeof fetch {
  const deadline = AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS);
  const received = { bytes: 0 };

  return async (url, init) => {
    const signals = [deadline];

    if (init?.signal !== undefined && init.signal !== null) {
      signals.push(init.signal);
    }

    const signal = AbortSignal.any(signals);
    const response = await fetch(url, { ...init, signal, redirect: 'error' });

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

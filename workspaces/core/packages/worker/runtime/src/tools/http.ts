import { rejectRedirect } from '@mechane/model-gateway';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';

type ToolFetchLimit = {
  readonly signal?: AbortSignal | undefined;
  readonly maximumBytes: number;
  readonly onExceeded: () => void;
};

export function boundedToolFetch({ signal: sharedSignal, maximumBytes, onExceeded }: ToolFetchLimit): typeof fetch {
  const deadline = AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS);

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

    let receivedBytes = 0;

    const bound = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength;

        if (receivedBytes > maximumBytes) {
          onExceeded();
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

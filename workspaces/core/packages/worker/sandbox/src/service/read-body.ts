import { BYTES_PER_MEBIBYTE } from '@mechane/records';

const REQUEST_MAX_BYTES = 3 * BYTES_PER_MEBIBYTE;

export class InvalidSandboxRequestError extends Error {
  constructor() {
    super('Invalid sandbox request');

    this.name = 'InvalidSandboxRequestError';
  }
}

export async function readBody(request: Request): Promise<unknown> {
  if (request.body === null) {
    throw new InvalidSandboxRequestError();
  }

  const reader: ReadableStreamDefaultReader<unknown> = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  const total = { bytes: 0 };

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const value = chunk.value;

      if (!(value instanceof Uint8Array)) {
        await reader.cancel();

        throw new InvalidSandboxRequestError();
      }

      total.bytes += value.byteLength;

      if (total.bytes > REQUEST_MAX_BYTES) {
        await reader.cancel();

        throw new InvalidSandboxRequestError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total.bytes);
  const position = { bytes: 0 };

  for (const chunk of chunks) {
    body.set(chunk, position.bytes);

    position.bytes += chunk.byteLength;
  }

  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body);

  return JSON.parse(text);
}

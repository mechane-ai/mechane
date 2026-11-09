import { RequestInvalid } from '@mechane/protocol';

const REQUEST_BODY_BYTES = 2_097_152;

export async function readTextBody(request: Request, maximumBytes = REQUEST_BODY_BYTES): Promise<string> {
  if (request.body === null) {
    throw new RequestInvalid({ reason: 'the request body is missing' });
  }

  const chunks: Array<Uint8Array> = [];
  const size = { bytes: 0 };
  const stream: ReadableStream<Uint8Array> = request.body;

  for await (const chunk of stream) {
    size.bytes += chunk.byteLength;

    if (size.bytes > maximumBytes) {
      throw new RequestInvalid({ reason: 'the request body exceeds the allowed size' });
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, size.bytes).toString('utf8');
}

export async function readJsonBody(request: Request, maximumBytes?: number): Promise<unknown> {
  const body = await readTextBody(request, maximumBytes);

  try {
    return JSON.parse(body);
  } catch {
    throw new RequestInvalid({ reason: 'the body is not JSON' });
  }
}

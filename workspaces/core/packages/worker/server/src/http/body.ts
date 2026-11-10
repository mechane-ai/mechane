import { RequestInvalid } from '@mechane/protocol';
import { Schema } from 'effect';

const REQUEST_BODY_BYTES = 2_097_152;

export async function readTextBody(request: Request, maximumBytes = REQUEST_BODY_BYTES): Promise<string> {
  if (request.body === null) {
    throw new RequestInvalid({ reason: 'the request body is missing' });
  }

  const fragments: Array<string> = [];
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
  const size = { bytes: 0 };
  const stream: ReadableStream<unknown> = request.body;

  for await (const chunk of stream) {
    const bytes = Schema.decodeUnknownSync(Schema.Uint8Array)(chunk);

    size.bytes += bytes.byteLength;

    if (size.bytes > maximumBytes) {
      throw new RequestInvalid({ reason: 'the request body exceeds the allowed size' });
    }

    fragments.push(decoder.decode(bytes, { stream: true }));
  }

  fragments.push(decoder.decode());

  return fragments.join('');
}

export async function readJsonBody(request: Request, maximumBytes?: number): Promise<unknown> {
  const body = await readTextBody(request, maximumBytes);

  try {
    return JSON.parse(body);
  } catch {
    throw new RequestInvalid({ reason: 'the body is not JSON' });
  }
}

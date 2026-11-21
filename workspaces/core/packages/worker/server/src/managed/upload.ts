import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { ManagedHttpError } from './http-error.ts';

const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

type MultipartOptions = {
  readonly request: Request;
  readonly maxBytes: number;
  readonly missingMessage: string;
  readonly oversizedMessage: string;
  readonly malformedMessage: string;
};

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join('');
}

export async function readBoundedMultipartForm({
  request,
  maxBytes,
  missingMessage,
  oversizedMessage,
  malformedMessage,
}: MultipartOptions): Promise<FormData> {
  const contentType = request.headers.get(HttpHeader.ContentType);

  if (
    contentType === null ||
    !contentType.toLowerCase().startsWith(`${MediaType.MultipartFormData};`) ||
    request.body === null
  ) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, missingMessage);
  }

  const progress = { bytes: 0 };

  const bounded = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        progress.bytes += chunk.byteLength;

        if (progress.bytes > maxBytes) {
          throw new ManagedHttpError(HttpStatusCode.BadRequest, oversizedMessage);
        }

        controller.enqueue(chunk);
      },
    }),
  );

  const payload = new Response(bounded, { headers: { [HttpHeader.ContentType]: contentType } });

  return await payload.formData().catch(() => {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, malformedMessage);
  });
}

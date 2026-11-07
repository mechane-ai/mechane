type ReadBodyInput = { readonly body: ReadableStream<Uint8Array>; readonly maximumBytes: number };

export async function readBoundedBytes({ body, maximumBytes }: ReadBodyInput): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Array<Uint8Array> = [];
  let totalBytes = 0;

  try {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      totalBytes += next.value.byteLength;

      if (totalBytes > maximumBytes) {
        throw new RangeError('Slack response or request exceeded the allowed size');
      }

      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
  }

  return Buffer.concat(chunks);
}

import { CliTarget, RELEASE, releaseBinaryKey, ReleaseManifest } from '@mechane/protocol';
import { Record, Schema } from 'effect';

const MANIFEST_MAX_BYTES = 16_384;

export async function readReleaseManifest(response: Response): Promise<ReleaseManifest> {
  if (response.body === null) {
    throw new Error('The public CLI manifest is empty');
  }

  const chunks: Array<Uint8Array> = [];
  const length = { bytes: 0 };
  const stream: ReadableStream<Uint8Array> = response.body;

  for await (const chunk of stream) {
    length.bytes += chunk.byteLength;

    if (length.bytes > MANIFEST_MAX_BYTES) {
      throw new Error('The public CLI manifest exceeds its size limit');
    }

    chunks.push(chunk);
  }

  const document: unknown = JSON.parse(Buffer.concat(chunks, length.bytes).toString('utf8'));
  const manifest = Schema.decodeUnknownSync(ReleaseManifest)(document);

  if (manifest.release !== RELEASE) {
    throw new Error('The public CLI manifest does not match the deployed release');
  }

  for (const target of Record.values(CliTarget)) {
    const binary = manifest.binaries[target];

    if (binary?.path !== releaseBinaryKey({ release: RELEASE, target })) {
      throw new Error('The public CLI manifest is missing a matching target');
    }
  }

  return manifest;
}

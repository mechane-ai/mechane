import { CliTarget, RELEASE, releaseBinaryKey, ReleaseManifest } from '@mechane/protocol';
import { Record, Schema } from 'effect';

const MANIFEST_MAX_BYTES = 16_384;

export async function readReleaseManifest(response: Response): Promise<ReleaseManifest> {
  if (response.body === null) {
    throw new Error('The public CLI manifest is empty');
  }

  const fragments: Array<string> = [];
  const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
  const length = { bytes: 0 };
  const stream: ReadableStream<unknown> = response.body;

  for await (const chunk of stream) {
    const bytes = Schema.decodeUnknownSync(Schema.Uint8Array)(chunk);

    length.bytes += bytes.byteLength;

    if (length.bytes > MANIFEST_MAX_BYTES) {
      throw new Error('The public CLI manifest exceeds its size limit');
    }

    fragments.push(decoder.decode(bytes, { stream: true }));
  }

  fragments.push(decoder.decode());

  const document: unknown = JSON.parse(fragments.join(''));
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

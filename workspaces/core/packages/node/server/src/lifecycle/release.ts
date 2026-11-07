import { RELEASE } from '@mechane/protocol';
import { Schema } from 'effect';
import { readFile } from 'node:fs/promises';

const ArtifactRelease = Schema.Struct({ version: Schema.Literal(RELEASE), revision: Schema.NonEmptyString });
type ArtifactReleaseInput = { readonly artifactUrl: URL };

export async function readArtifactRelease({ artifactUrl }: ArtifactReleaseInput) {
  const url = new URL('release.json', artifactUrl);
  const text = await readFile(url, 'utf8');

  return Schema.decodeUnknownSync(ArtifactRelease)(JSON.parse(text));
}

import { SHA256_DIGEST_PATTERN } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './process.ts';
import type { Environment } from './types.ts';

const CORE_DIRECTORY = fileURLToPath(new URL('../../../../', import.meta.url));
const GUEST_DIRECTORY = fileURLToPath(new URL('../../guest/image/', import.meta.url));
const SOURCE_BUILD_TIMEOUT = Duration.minutes(5);
const IMAGE_BUILD_TIMEOUT = Duration.minutes(20);
const IMAGE_INSPECTION_TIMEOUT = Duration.seconds(30);

const IMAGE_INPUTS: ReadonlyArray<string> = [
  'Dockerfile',
  'gh-LICENSE',
  'guest.mjs',
  'install-tools.sh',
  'mechane',
  'mechane.mjs',
  'mise-LICENSE',
];

const ImageId = Schema.String.check(Schema.isPattern(SHA256_DIGEST_PATTERN));
type ImageId = typeof ImageId.Type;

const ExistingImageId = Schema.Union([Schema.Literal(''), ImageId]);
type ExistingImageId = typeof ExistingImageId.Type;

type PrepareSourceGuestInput = { readonly environment: Environment };
type GuestInputPathInput = { readonly name: string };

export async function prepareSourceGuest({ environment }: PrepareSourceGuestInput): Promise<string> {
  await runCommand({
    command: 'mise',
    args: ['-C', CORE_DIRECTORY, 'run', 'build:guest'],
    environment,
    timeoutMs: Duration.toMillis(SOURCE_BUILD_TIMEOUT),
  });

  const digest = createHash('sha256');

  for (const name of IMAGE_INPUTS) {
    const path = guestInputPath({ name });
    const contents = await readFile(path);
    const checksum = createHash('sha256').update(contents).digest('hex');

    digest.update(name);
    digest.update(checksum);
  }

  const image = `mechane-source:${digest.digest('hex')}`;

  const existing = await runCommand({
    command: 'docker',
    args: ['image', 'ls', '--quiet', '--no-trunc', image],
    environment,
    timeoutMs: Duration.toMillis(IMAGE_INSPECTION_TIMEOUT),
  });

  const existingId = Schema.decodeUnknownSync(ExistingImageId, { onExcessProperty: 'error' })(existing.trim());

  if (existingId === '') {
    await runCommand({
      command: 'docker',
      args: ['buildx', 'build', '--load', '--tag', image, GUEST_DIRECTORY],
      environment,
      timeoutMs: Duration.toMillis(IMAGE_BUILD_TIMEOUT),
    });
  }

  const inspected = await runCommand({
    command: 'docker',
    args: ['image', 'inspect', '--format', '{{.Id}}', image],
    environment,
    timeoutMs: Duration.toMillis(IMAGE_INSPECTION_TIMEOUT),
  });

  return Schema.decodeUnknownSync(ImageId, { onExcessProperty: 'error' })(inspected.trim());
}

function guestInputPath({ name }: GuestInputPathInput): string {
  return join(GUEST_DIRECTORY, name);
}

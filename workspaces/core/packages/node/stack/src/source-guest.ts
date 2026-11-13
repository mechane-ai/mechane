import { SHA256_DIGEST_PATTERN } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import { guestImageInputs } from './guest-image-inputs.ts';
import { runCommand } from './process.ts';
import type { Environment } from './types.ts';

const CORE_DIRECTORY = fileURLToPath(new URL('../../../../', import.meta.url));
const GUEST_DIRECTORY = fileURLToPath(new URL('../../guest/image/', import.meta.url));
const SOURCE_BUILD_TIMEOUT = Duration.minutes(5);
const IMAGE_BUILD_TIMEOUT = Duration.minutes(20);
const IMAGE_INSPECTION_TIMEOUT = Duration.seconds(30);

const ImageId = Schema.String.check(Schema.isPattern(SHA256_DIGEST_PATTERN));
type ImageId = typeof ImageId.Type;

const ExistingImageId = Schema.Union([Schema.Literal(''), ImageId]);
type ExistingImageId = typeof ExistingImageId.Type;

type PrepareSourceGuestInput = { readonly environment: Environment };

export async function prepareSourceGuest({ environment }: PrepareSourceGuestInput): Promise<string> {
  await runCommand({
    command: 'mise',
    args: ['-C', CORE_DIRECTORY, 'run', 'build:guest'],
    environment,
    timeoutMs: Duration.toMillis(SOURCE_BUILD_TIMEOUT),
  });

  const inputs = await guestImageInputs({ directory: GUEST_DIRECTORY, platform: 'local' });
  const image = `mechane-source:${inputs.sha256}`;

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

import { writeDiagnostic } from '@mechane/program';
import { SHA256_DIGEST_PATTERN } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { guestImageInputs, GuestImageRecord } from './guest-image-inputs.ts';
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

type PrepareSourceGuestInput = { readonly environment: Environment; readonly reuseGuest?: string | undefined };

const InspectedImage = Schema.Struct({
  Id: ImageId,
  Os: Schema.Literal('linux'),
  Architecture: Schema.NonEmptyString,
  Descriptor: Schema.Struct({ digest: ImageId }),
});

type InspectGuestImageInput = Pick<PrepareSourceGuestInput, 'environment'> & { readonly digest: string };

export async function inspectGuestImage({ environment, digest }: InspectGuestImageInput) {
  const output = await runCommand({
    command: 'docker',
    args: ['image', 'inspect', digest],
    environment,
    timeoutMs: Duration.toMillis(IMAGE_INSPECTION_TIMEOUT),
  });

  const [image] = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(InspectedImage)))(output);

  if (image === undefined || image.Descriptor.digest !== digest) {
    throw new Error('Docker does not have the selected guest manifest');
  }

  return image;
}

export async function prepareSourceGuest({ environment, reuseGuest }: PrepareSourceGuestInput): Promise<string> {
  await runCommand({
    command: 'mise',
    args: ['-C', CORE_DIRECTORY, 'run', 'build:guest'],
    environment,
    timeoutMs: Duration.toMillis(SOURCE_BUILD_TIMEOUT),
  });

  if (reuseGuest !== undefined) {
    const text = await readFile(reuseGuest, 'utf8');
    const record = Schema.decodeUnknownSync(Schema.fromJsonString(GuestImageRecord))(text);
    const inputs = await guestImageInputs({ directory: GUEST_DIRECTORY, platform: record.inputs.platform });

    if (inputs.sha256 !== record.inputs.sha256) {
      throw new Error('The selected guest inputs differ from the source build');
    }

    const image = await inspectGuestImage({ environment, digest: record.guest.digest });

    if (`linux/${image.Architecture}` !== record.inputs.platform) {
      throw new Error('The selected guest platform differs from its build record');
    }

    writeDiagnostic({ program: 'stack', line: `Reusing guest ${record.guest.digest}` });

    return image.Id;
  }

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
    writeDiagnostic({ program: 'stack', line: 'Building the local guest image' });

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

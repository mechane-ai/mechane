import { Effect, Option, Schema } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveDocument } from '../files/archive-document.ts';
import type { DistributionSettings } from '../types.ts';
import { OciDescriptor } from './oci.schemas.ts';
import { verifyOciBlob } from './verify-oci-blob.ts';

const OCI_CONFIGURATION_KEY = 'config';

const OCI_LAYOUT_VERSION = '1.0.0';

const OCI_PLATFORM = { architecture: 'amd64', system: 'linux' } as const;

const OciManifest = Schema.Struct({ [OCI_CONFIGURATION_KEY]: OciDescriptor, layers: Schema.Array(OciDescriptor) });

type OciManifest = typeof OciManifest.Type;

const OciIndex = Schema.Struct({ manifests: Schema.Array(OciDescriptor) });

type OciIndex = typeof OciIndex.Type;

const OciLayout = Schema.Struct({ imageLayoutVersion: Schema.Literal(OCI_LAYOUT_VERSION) });

type OciLayout = typeof OciLayout.Type;

const OciPlatform = Schema.Struct({
  architecture: Schema.Literal(OCI_PLATFORM.architecture),
  os: Schema.Literal(OCI_PLATFORM.system),
});

type OciPlatform = typeof OciPlatform.Type;

type GuestInput = { readonly path: string; readonly settings: DistributionSettings };

/** Reads the single Linux amd64 image descriptor without trusting an archive's index digest as its image identity. */
export const guestImageDigest = Effect.fn('guestImageDigest')(function* ({
  path,
  settings,
}: GuestInput): Effect.fn.Return<string, DistributionFailed> {
  yield* archiveDocument({ path, entry: 'oci-layout', schema: OciLayout, settings });

  const index = yield* archiveDocument({ path, entry: 'index.json', schema: OciIndex, settings });
  const [first] = index.manifests;
  const image = Option.fromNullishOr(first);

  if (index.manifests.length !== 1 || Option.isNone(image)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive must contain one Linux amd64 image',
    });
  }

  const manifestPath = yield* verifyOciBlob({ path, descriptor: image.value, settings });
  const manifest = yield* archiveDocument({ path, entry: manifestPath, schema: OciManifest, settings });
  const configurationPath = yield* verifyOciBlob({ path, descriptor: manifest[OCI_CONFIGURATION_KEY], settings });

  yield* archiveDocument({ path, entry: configurationPath, schema: OciPlatform, settings });

  for (const layer of manifest.layers) {
    yield* verifyOciBlob({ path, descriptor: layer, settings });
  }

  return image.value.digest;
});

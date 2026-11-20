import { decodeJsonc } from '@mechane/wrangler';
import { Effect, Option, Schema } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { DistributionSettings } from '../types.ts';
import { OciDescriptor } from './oci.schemas.ts';
import { scanOciTar } from './scan-oci-tar.ts';
import type { ScannedTarEntry } from './scan-oci-tar.ts';
import { verifyOciBlob } from './verify-oci-blob.ts';

const OCI_CONFIGURATION_KEY = 'config';

const OCI_LAYOUT_VERSION = '1.0.0';

const OCI_PLATFORM = { architecture: 'amd64', system: 'linux' } as const;

const OciManifest = Schema.Struct({ [OCI_CONFIGURATION_KEY]: OciDescriptor, layers: Schema.Array(OciDescriptor) });

const OciIndex = Schema.Struct({ manifests: Schema.Array(OciDescriptor) });

const OciLayout = Schema.Struct({ imageLayoutVersion: Schema.Literal(OCI_LAYOUT_VERSION) });

const OciPlatform = Schema.Struct({
  architecture: Schema.Literal(OCI_PLATFORM.architecture),
  os: Schema.Literal(OCI_PLATFORM.system),
});

type GuestInput = { readonly path: string; readonly settings: DistributionSettings };

type DecodeEntryInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly entry: Option.Option<ScannedTarEntry>;
  readonly schema: S;
};

const decodeScannedDocument = Effect.fn('decodeScannedDocument')(function* <S extends Schema.Codec<unknown, unknown>>({
  entry,
  schema,
}: DecodeEntryInput<S>): Effect.fn.Return<S['Type'], DistributionFailed, S['DecodingServices']> {
  if (Option.isNone(entry) || entry.value.text === null) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive metadata entry is missing or exceeds text size limit',
    });
  }

  return yield* decodeJsonc({
    text: entry.value.text,
    schema,
    options: {},
    step: DistributionStep.Verify,
    subjects: [],
    failure: DistributionFailed,
  });
});

/** Reads the single Linux amd64 image descriptor in one streaming pass without trusting an archive's index digest. */
export const guestImageDigest = Effect.fn('guestImageDigest')(function* ({
  path,
}: GuestInput): Effect.fn.Return<string, DistributionFailed> {
  const entries = yield* scanOciTar({ path });

  yield* decodeScannedDocument({ entry: Option.fromNullishOr(entries.get('oci-layout')), schema: OciLayout });

  const index = yield* decodeScannedDocument({
    entry: Option.fromNullishOr(entries.get('index.json')),
    schema: OciIndex,
  });

  const [first] = index.manifests;
  const image = Option.fromNullishOr(first);

  if (index.manifests.length !== 1 || Option.isNone(image)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive must contain one Linux amd64 image',
    });
  }

  const manifestEntry = yield* verifyOciBlob({ entries, descriptor: image.value });
  const manifest = yield* decodeScannedDocument({ entry: Option.some(manifestEntry), schema: OciManifest });
  const configurationEntry = yield* verifyOciBlob({ entries, descriptor: manifest[OCI_CONFIGURATION_KEY] });

  yield* decodeScannedDocument({ entry: Option.some(configurationEntry), schema: OciPlatform });

  for (const layer of manifest.layers) {
    yield* verifyOciBlob({ entries, descriptor: layer });
  }

  return image.value.digest;
});

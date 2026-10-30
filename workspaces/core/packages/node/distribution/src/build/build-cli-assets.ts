import { CliTarget, RELEASE, ReleaseAsset, releaseBinaryName } from '@mechane/protocol';
import type { ReleaseManifest } from '@mechane/protocol';
import { buildRelease } from '@mechane/release';
import { Effect, Option, Record } from 'effect';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { writeDocument } from '../files/write-document.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type CliAssetsInput = { readonly settings: DistributionSettings; readonly commit: string };

/** Builds each supported CLI with the public source commit, preserving the existing download manifest format. */
export const buildCliAssets = Effect.fn('buildCliAssets')(function* ({
  settings,
  commit,
}: CliAssetsInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const folder = join(settings.folder, 'cli-build');
  const targets = Record.values(CliTarget);

  const { manifest } = yield* buildRelease({
    release: RELEASE,
    revision: commit,
    targets,
    folder,
    inherited: settings.inherited,
  }).pipe(Effect.mapError(({ reason }) => new DistributionFailed({ step: DistributionStep.Command, reason })));

  const binaries = yield* Effect.forEach(targets, (target) => copyBinary({ target, manifest, folder, settings }), {
    concurrency: 1,
  });

  const path = join(settings.folder, ReleaseAsset.Manifest);

  yield* writeDocument({ path, document: manifest });

  const digest = yield* fileDigest({ path });

  return [...binaries, { name: ReleaseAsset.Manifest, ...digest }];
});

type CopyBinaryInput = {
  readonly target: CliTarget;
  readonly manifest: ReleaseManifest;
  readonly folder: string;
  readonly settings: DistributionSettings;
};

const copyBinary = Effect.fn('copyBinary')(function* ({
  target,
  manifest,
  folder,
  settings,
}: CopyBinaryInput): Effect.fn.Return<Artifact, DistributionFailed> {
  const candidate = Option.fromNullishOr(manifest.binaries[target]);

  if (Option.isNone(candidate)) {
    return yield* new DistributionFailed({ step: DistributionStep.Verify, reason: 'compiled CLI target is missing' });
  }

  const binary = candidate.value;

  const name = releaseBinaryName({ target });
  const source = join(folder, binary.path);
  const destination = join(settings.folder, name);

  yield* Effect.tryPromise({
    try: () => copyFile(source, destination),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  return { name, sha256: binary.sha256, bytes: binary.bytes };
});

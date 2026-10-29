import { ReleaseKey, ReleaseManifest, releaseManifestKey } from '@mechane/protocol';
import type { CliTarget, Release } from '@mechane/protocol';
import { Effect, Record, Schema } from 'effect';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ReleaseStep } from '../constants.ts';
import { ReleaseFailed } from '../errors.ts';
import { compileBinary } from './compile-binary.ts';
import type { BuiltRelease } from './types.ts';

/**
 * The release to build, the revision of the source it is built from, the targets to compile it for, and the folder that
 * receives its files at their keys.
 */
type BuildReleaseInput = {
  readonly release: Release;
  readonly revision: string;
  readonly targets: ReadonlyArray<CliTarget>;
  readonly folder: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Writes a release's files below `folder` at their bucket keys: a binary for each target and the release's own manifest
 * in its folder. Then it writes `cli/latest.json`, the same manifest, which a publish of the folder writes last.
 */
export const buildRelease = Effect.fn('buildRelease')(function* ({
  release,
  revision,
  targets,
  folder,
  inherited,
}: BuildReleaseInput): Effect.fn.Return<BuiltRelease, ReleaseFailed> {
  const manifestKey = releaseManifestKey({ release });
  const releaseFolder = dirname(join(folder, manifestKey));

  yield* Effect.tryPromise({
    try: () => mkdir(releaseFolder, { recursive: true }),
    catch: (cause) => new ReleaseFailed({ step: ReleaseStep.CreateReleaseFolder, reason: String(cause) }),
  });

  const binaries = yield* Effect.forEach(targets, (target) => compileBinary({ release, target, folder, inherited }), {
    concurrency: 1,
  });

  const manifest = { release, revision, binaries: Record.fromEntries(binaries) };
  const text = Schema.encodeSync(Schema.fromJsonString(ReleaseManifest))(manifest);

  for (const key of [manifestKey, ReleaseKey.Latest]) {
    const path = join(folder, key);

    yield* Effect.tryPromise({
      try: () => writeFile(path, text),
      catch: (cause) => new ReleaseFailed({ step: ReleaseStep.WriteManifest, reason: String(cause) }),
    });
  }

  return { manifest, text };
});

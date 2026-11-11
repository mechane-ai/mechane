import { RELEASE_REPOSITORY } from '@mechane/protocol';
import { Effect } from 'effect';
import { join } from 'node:path';
import { FORMAT_VERSION } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import { RUNTIME_OUTPUT_FOLDER, RuntimeBuild, runtimeCommands } from '../runtime-artifact.ts';
import type { RuntimeRelease } from '../runtime-artifact.ts';
import type { Artifact, InstallationManifest } from '../schemas.ts';
import type { FileDigest } from '../types.ts';

type RuntimeReleaseInput = {
  readonly manifest: InstallationManifest;
  readonly archive: Artifact;
  readonly installation: FileDigest;
  readonly providerSetup: Artifact;
};

export const runtimeRelease = Effect.fn('runtimeRelease')(function* ({
  manifest,
  archive,
  installation,
  providerSetup,
}: RuntimeReleaseInput): Effect.fn.Return<RuntimeRelease, DistributionFailed> {
  const build = yield* readDocument({ path: join(RUNTIME_OUTPUT_FOLDER, 'build.json'), schema: RuntimeBuild });

  return {
    format_version: FORMAT_VERSION,
    version: manifest.version,
    repository: RELEASE_REPOSITORY,
    public_commit: manifest.public_commit,
    runtime: { archive: archive.name, sha256: archive.sha256, bytes: archive.bytes },
    installation: { path: 'installation.json', ...installation },
    provider_setup: providerSetup,
    commands: runtimeCommands({ nodeVersion: build.node_version }),
  };
});

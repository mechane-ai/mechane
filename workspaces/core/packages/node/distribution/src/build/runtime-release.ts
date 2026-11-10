import { RELEASE_REPOSITORY } from '@mechane/protocol';
import { Effect } from 'effect';
import { join } from 'node:path';
import { FORMAT_VERSION } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import {
  GRANT_ENTRYPOINT,
  IMPORT_ENTRYPOINT,
  MIGRATION_ENTRYPOINT,
  RUNTIME_OUTPUT_FOLDER,
  RuntimeBuild,
} from '../runtime-artifact.ts';
import type { RuntimeRelease } from '../runtime-artifact.ts';
import type { Artifact, InstallationManifest } from '../schemas.ts';
import type { FileDigest } from '../types.ts';

type RuntimeReleaseInput = {
  readonly manifest: InstallationManifest;
  readonly archive: Artifact;
  readonly installation: FileDigest;
};

export const runtimeRelease = Effect.fn('runtimeRelease')(function* ({
  manifest,
  archive,
  installation,
}: RuntimeReleaseInput): Effect.fn.Return<RuntimeRelease, DistributionFailed> {
  const build = yield* readDocument({ path: join(RUNTIME_OUTPUT_FOLDER, 'build.json'), schema: RuntimeBuild });

  return {
    format_version: FORMAT_VERSION,
    version: manifest.version,
    repository: RELEASE_REPOSITORY,
    public_commit: manifest.public_commit,
    runtime: { archive: archive.name, sha256: archive.sha256, bytes: archive.bytes },
    installation: { path: 'installation.json', ...installation },
    commands: {
      node_version: build.node_version,
      migrate: { entrypoint: MIGRATION_ENTRYPOINT, arguments: [], environment: ['MECHANE_MIGRATION_DATABASE_URL'] },
      grant: {
        entrypoint: GRANT_ENTRYPOINT,
        arguments: [],
        environment: ['MECHANE_MIGRATION_DATABASE_URL', 'MECHANE_RUNTIME_DATABASE_ROLE'],
      },
      import: {
        entrypoint: IMPORT_ENTRYPOINT,
        arguments: ['--dry-run', '--all'],
        environment: ['MECHANE_MIGRATION_DATABASE_URL'],
        apply_environment: ['MECHANE_ORIGIN', 'MECHANE_SANDBOX_SERVICE_KEY'],
        apply_required_options: ['--expect-digest', '--retirement-receipt', '--retirement-sha256'],
      },
    },
  };
});

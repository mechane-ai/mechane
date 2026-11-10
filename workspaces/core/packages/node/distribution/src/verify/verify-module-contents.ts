import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveEntryDigest } from '../files/archive-entry-digest.ts';
import type { InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyContentsInput = {
  readonly settings: DistributionSettings;
  readonly manifest: InstallationManifest;
  readonly path: string;
};

/** Refuses changed module inputs and Worker bytes before publication. */
export const verifyModuleContents = Effect.fn('verifyModuleContents')(function* ({
  settings,
  manifest,
  path,
}: VerifyContentsInput): Effect.fn.Return<void, DistributionFailed> {
  const runtime = manifest.runtime_files.map((file) => ({ name: file.path, sha256: file.sha256, bytes: file.bytes }));
  const files = [...manifest.module_files, ...runtime];

  for (const file of files) {
    const actual = yield* archiveEntryDigest({ path, entry: file.name, settings, format: 'zip' });

    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: 'module file differs from its checksum',
      });
    }
  }
});

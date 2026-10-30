import { sha256Hex } from '@mechane/program';
import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { runCommand } from '../files/run-command.ts';
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
  const worker = { name: manifest.worker.path, sha256: manifest.worker.sha256, bytes: manifest.worker.bytes };
  const files = [...manifest.module_files, worker];

  for (const file of files) {
    const contents = yield* runCommand({ command: 'unzip', args: ['-p', path, file.name], settings });
    const sha256 = sha256Hex({ contents });

    if (sha256 !== file.sha256 || Buffer.byteLength(contents) !== file.bytes) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: 'module file differs from its checksum',
      });
    }
  }
});

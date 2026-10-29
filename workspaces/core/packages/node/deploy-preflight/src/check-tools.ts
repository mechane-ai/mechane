import { PROGRAM, runWrangler, temporaryFolder, WRANGLER_READ_TIMEOUT } from '@mechane/deploy-kernel';
import type { DeployFailed, OperatorModeInput } from '@mechane/deploy-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Effect } from 'effect';
import { checkDocker } from './check-docker.ts';

/** Checks both installation buckets, its image build engine and the rendered Worker without uploading anything. */
export function checkTools({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  const { credentials } = settings;

  return Effect.gen(function* () {
    for (const bucket of [rendered.releasesBucket, rendered.workspaceBucket]) {
      yield* runWrangler({
        args: ['r2', 'bucket', 'info', bucket],
        settings,
        credentials,
        timeout: WRANGLER_READ_TIMEOUT,
      });
      writeDiagnostic({ program: PROGRAM, line: `bucket: wrangler r2 bucket info ${bucket} answers` });
    }

    yield* checkDocker({ settings });
    yield* dryRun({ settings, rendered });
    writeDiagnostic({ program: PROGRAM, line: 'dry run: wrangler deploy --dry-run passes' });
  });
}

/** Runs `wrangler deploy --dry-run` of the rendered configuration into a fresh folder. */
function dryRun({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  const { credentials } = settings;
  const args = ['deploy', '--dry-run', '--config', rendered.configurationPath, '--containers-rollout=none', '--outdir'];

  return Effect.scoped(
    temporaryFolder({ settings }).pipe(
      Effect.flatMap((outdir) =>
        runWrangler({ args: [...args, outdir], settings, credentials, timeout: WRANGLER_READ_TIMEOUT }),
      ),
    ),
  ).pipe(Effect.asVoid);
}

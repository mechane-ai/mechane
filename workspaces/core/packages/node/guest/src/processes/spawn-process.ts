import { Bytes } from '@mechane/records';
import { OUTPUT_TAIL_BYTES } from '@mechane/sandbox-wire';
import type { ProcessStart } from '@mechane/sandbox-wire';
import { Effect, Result } from 'effect';
import { shellEnvironment } from '../executions/shell-environment.ts';
import { spawnShell } from '../executions/spawn-shell.ts';
import { spawnedBash } from '../executions/spawned-bash.ts';
import type { BashRun } from '../executions/types.ts';
import type { GuestSettings } from '../types.ts';
import { ProcessFailed } from './process-failed.ts';

type SpawnProcessInput = { readonly request: ProcessStart; readonly settings: GuestSettings };

/** Creates a detached process group with the same explicit environment and output collection as foreground bash. */
export const spawnProcess = Effect.fn('spawnProcess')(function* ({
  request,
  settings,
}: SpawnProcessInput): Effect.fn.Return<BashRun, ProcessFailed> {
  const environment = shellEnvironment({ request, settings });

  return yield* Effect.callback<BashRun, ProcessFailed>((resume) => {
    const child = spawnShell({ command: request.command, home: settings.home, environment });

    child.once('error', (failure) => {
      const error = new ProcessFailed({ processId: request.processId, reason: failure.message });

      resume(error);
    });
    child.once('spawn', () => {
      const outputLimit = Bytes.make(OUTPUT_TAIL_BYTES);
      const run = spawnedBash({ child, outputLimit });
      const result = Result.succeed(run);
      const started = Effect.fromResult(result);

      resume(started);
    });
  });
});

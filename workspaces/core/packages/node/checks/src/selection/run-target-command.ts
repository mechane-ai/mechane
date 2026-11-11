import { InputUnreadable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { InheritedInput } from '@mechane/checks-kernel';
import { Duration, Effect } from 'effect';
import { spawn } from 'node:child_process';

type RunTargetCommandInput = InheritedInput & { readonly command: string; readonly args: ReadonlyArray<string> };

const TARGET_TIMEOUT = Duration.hours(2);

export const runTargetCommand = Effect.fn('runTargetCommand')(function* ({
  command,
  args,
  inherited,
}: RunTargetCommandInput): Effect.fn.Return<void, InputUnreadable> {
  const line = [command, ...args].join(' ');
  const timeout = Duration.toMillis(TARGET_TIMEOUT);

  yield* Effect.callback<void, InputUnreadable>((resume) => {
    const child = spawn(command, [...args], { cwd: WORKSPACE_FOLDER, env: inherited, stdio: 'inherit', timeout });

    child.once('error', (cause) => {
      const reason = String(cause);
      const failure = new InputUnreadable({ path: line, reason });

      resume(failure);
    });
    child.once('close', (status, stoppedBy) => {
      if (status === 0) {
        resume(Effect.void);

        return;
      }

      const reason = `exited ${String(status)} with signal ${String(stoppedBy)}`;

      const failure = new InputUnreadable({ path: line, reason });

      resume(failure);
    });

    return Effect.sync(() => {
      child.kill('SIGTERM');
    });
  });
});

import { Deferred, Duration, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { ProcessFailed } from './errors.ts';
import type { ProcessOutput, ProcessRun, RunningProcess, StartProcessInput } from './types.ts';

type SpawnCollectingInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Readonly<Record<string, string>>;
  readonly exit: Deferred.Deferred<ProcessRun, ProcessFailed>;
  readonly onOutput?: StartProcessInput['onOutput'];
};

/** A spawned child: what it has written to each stream so far, and the kill that stops it. */
type CollectingChild = { readonly stdout: () => string; readonly stderr: () => string; readonly kill: () => boolean };

/**
 * Starts a command with only `environment` as its environment and collects what it writes to each stream, which a
 * caller may read while it runs. Its exit fails once the process outlives `timeout`, and closing the scope kills it.
 */
export const startProcess = Effect.fn('startProcess')(function* ({
  command,
  args,
  environment,
  timeout,
  onOutput,
}: StartProcessInput): Effect.fn.Return<RunningProcess, never, Scope.Scope> {
  const late = new ProcessFailed({ command, reason: `no exit within ${Duration.format(timeout)}` });
  const exit = yield* Deferred.make<ProcessRun, ProcessFailed>();

  const { stdout, stderr } = yield* Effect.acquireRelease(
    Effect.sync(() => spawnCollecting({ command, args, environment, exit, onOutput })),
    ({ kill }) => Effect.sync(kill),
  );

  const exited = Deferred.await(exit).pipe(
    Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(late) }),
  );

  return { stdout, stderr, exited };
});

/** Spawns the command and collects its output, completing `exit` with the run when the process closes. */
function spawnCollecting({ command, args, environment, exit, onOutput }: SpawnCollectingInput): CollectingChild {
  const child = spawn(command, args, { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];

  const failed: (error: Error) => void = (error) =>
    Deferred.doneUnsafe(exit, Effect.fail(new ProcessFailed({ command, reason: error.message })));

  // The close event reports the code `exitCode` holds: none once a signal ended the process.
  const closed: (code: ChildProcess['exitCode']) => void = (code) =>
    Deferred.doneUnsafe(
      exit,
      Effect.succeed({ status: Option.fromNullishOr(code), stdout: stdout.join(''), stderr: stderr.join('') }),
    );

  function observe({ stream, contents }: ProcessOutput): void {
    try {
      onOutput?.({ stream, contents });
    } catch {
      // A progress observer cannot replace the command's actual outcome.
    }
  }

  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    stdout.push(chunk);
    observe({ stream: 'stdout', contents: chunk });
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr.push(chunk);
    observe({ stream: 'stderr', contents: chunk });
  });
  child.on('error', failed);
  child.on('close', closed);

  return { stdout: () => stdout.join(''), stderr: () => stderr.join(''), kill: () => child.kill('SIGKILL') };
}

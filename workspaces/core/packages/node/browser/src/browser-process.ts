import { Deferred, Duration, Effect, Option, Result, Schema } from 'effect';
import type { Scope } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { BrowserFileError } from './devtools.schemas.ts';
import { BrowserFailed, BrowserFailureKind } from './errors.ts';

const PROCESS_OUTPUT_MAX_CHARS = 8192;
const PROCESS_STOP_TIMEOUT = Duration.seconds(3);
const MISSING_PROCESS = 'ESRCH';

/** A child owns its process group until one recorded stop attempt retires it. */
export type BrowserChild = {
  readonly child: ChildProcessWithoutNullStreams;
  readonly groupId: number;
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly exited: Deferred.Deferred<number, BrowserFailed>;
  readonly stop: () => Result.Result<void, BrowserFailed>;
};

type BrowserChildInput = { readonly running: BrowserChild };

/** The groups still owned by this browser runtime, including any that failed to stop. */
export type BrowserChildren = {
  readonly remember: (input: BrowserChildInput) => void;
  readonly forget: (input: BrowserChildInput) => void;
  readonly all: () => ReadonlyArray<BrowserChild>;
  readonly clear: () => void;
};

/** Tracks group ownership separately from the leader's exit and pipe lifetime. */
export function browserChildren(): BrowserChildren {
  const children = new Set<BrowserChild>();

  const remember: BrowserChildren['remember'] = ({ running }) => {
    children.add(running);
  };

  const forget: BrowserChildren['forget'] = ({ running }) => {
    children.delete(running);
  };

  const all: BrowserChildren['all'] = () => [...children];

  const clear: BrowserChildren['clear'] = () => {
    children.clear();
  };

  return { remember, forget, all, clear };
}

type StartBrowserChildInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Readonly<Record<string, string>>;
  readonly children: BrowserChildren;
};

/** Starts a group whose same-group descendants are stopped when its leader exits. */
export const startBrowserChild = Effect.fn('startBrowserChild')(function* ({
  command,
  args,
  environment,
  children,
}: StartBrowserChildInput): Effect.fn.Return<BrowserChild, BrowserFailed> {
  return yield* Effect.callback<BrowserChild, BrowserFailed>((resume) => {
    const child = spawn(command, args, { env: environment, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const exited = Deferred.makeUnsafe<number, BrowserFailed>();
    const output = { stdout: '', stderr: '' };

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output.stdout = `${output.stdout}${chunk}`.slice(-PROCESS_OUTPUT_MAX_CHARS);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      output.stderr = `${output.stderr}${chunk}`.slice(-PROCESS_OUTPUT_MAX_CHARS);
    });
    child.once('error', (error) => {
      const failure = new BrowserFailed({
        kind: BrowserFailureKind.Process,
        reason: `${command} could not start: ${error.message}`,
      });

      const outcome = Result.fail(failure);
      const failed = Effect.fromResult(outcome);

      Deferred.doneUnsafe(exited, failed);
      resume(failed);
    });
    child.once('spawn', () => {
      const group = Option.fromNullishOr(child.pid);

      if (Option.isNone(group)) {
        const failure = new BrowserFailed({
          kind: BrowserFailureKind.Process,
          reason: `${command} started without a process identity`,
        });

        const outcome = Result.fail(failure);
        const failed = Effect.fromResult(outcome);

        resume(failed);

        return;
      }

      const groupId = group.value;
      const state = { stopped: Option.none<Result.Result<void, BrowserFailed>>() };

      const stop: BrowserChild['stop'] = () => {
        if (Option.isSome(state.stopped)) {
          return state.stopped.value;
        }

        const result = stopBrowserGroup({ groupId });

        state.stopped = Option.some(result);

        return result;
      };

      const running: BrowserChild = {
        child,
        groupId,
        exited,
        stop,
        stdout: () => output.stdout,
        stderr: () => output.stderr,
      };

      children.remember({ running });
      child.once('exit', () => {
        const stopped = stop();

        if (Result.isSuccess(stopped)) {
          children.forget({ running });
        }
      });
      child.once('close', (code) => {
        const stopped = stop();

        if (Result.isFailure(stopped)) {
          const outcome = Result.fail(stopped.failure);
          const failed = Effect.fromResult(outcome);

          Deferred.doneUnsafe(exited, failed);

          return;
        }

        const status = Option.fromNullishOr(code);
        const result = Option.getOrElse(status, () => -1);
        const outcome = Result.succeed(result);
        const finished = Effect.fromResult(outcome);

        Deferred.doneUnsafe(exited, finished);
      });

      const outcome = Result.succeed(running);
      const started = Effect.fromResult(outcome);

      resume(started);
    });
  });
});

type StopBrowserChildrenInput = { readonly children: BrowserChildren };

/** Stops every retained group and reports a signal failure without retiring that group. */
export const stopBrowserChildren = Effect.fn('stopBrowserChildren')(function* ({
  children,
}: StopBrowserChildrenInput): Effect.fn.Return<void, BrowserFailed> {
  for (const running of children.all()) {
    yield* stopBrowserChild({ running });
  }

  children.clear();
});

const stopBrowserChild = Effect.fn('stopBrowserChild')(function* ({
  running,
}: BrowserChildInput): Effect.fn.Return<void, BrowserFailed> {
  const stopped = running.stop();

  yield* Effect.fromResult(stopped);

  const absent = Option.none();
  const absentResult = Result.succeed(absent);

  yield* Deferred.await(running.exited).pipe(
    Effect.timeoutOption(PROCESS_STOP_TIMEOUT),
    Effect.catchTags({ BrowserFailed: () => Effect.fromResult(absentResult) }),
  );
});

type StopBrowserGroupInput = { readonly groupId: number };

function stopBrowserGroup({ groupId }: StopBrowserGroupInput): Result.Result<void, BrowserFailed> {
  const killed = Result.try(() => process.kill(-groupId, 'SIGKILL'));

  if (Result.isFailure(killed)) {
    const decoded = Schema.decodeUnknownResult(BrowserFileError)(killed.failure);

    if (Result.isFailure(decoded) || decoded.success.code !== MISSING_PROCESS) {
      const failure = new BrowserFailed({
        kind: BrowserFailureKind.Process,
        reason: `browser process group ${groupId} could not stop`,
      });

      return Result.fail(failure);
    }
  }

  return Result.succeed(undefined);
}

type RunBrowserChildInput = StartBrowserChildInput & { readonly timeout: Duration.Duration };
type BrowserChildOutput = { readonly stdout: string; readonly stderr: string };

/** Returns bounded output after command completion and releases the command's process group. */
export const runBrowserChild = Effect.fn('runBrowserChild')(function* (
  input: RunBrowserChildInput,
): Effect.fn.Return<BrowserChildOutput, BrowserFailed, Scope.Scope> {
  const release = Effect.fn('release')(function* (running: BrowserChild): Effect.fn.Return<void> {
    yield* stopBrowserChild({ running }).pipe(Effect.orDie);

    input.children.forget({ running });
  });

  const starting = startBrowserChild(input);
  const running = yield* Effect.acquireRelease(starting, release);

  const timeoutFailure = new BrowserFailed({
    kind: BrowserFailureKind.Process,
    reason: `${input.command} exceeded its deadline`,
  });

  const timedOut = Result.fail(timeoutFailure);

  const code = yield* Deferred.await(running.exited).pipe(
    Effect.timeoutOrElse({ duration: input.timeout, orElse: () => Effect.fromResult(timedOut) }),
  );

  if (code !== 0) {
    const stderr = running.stderr();

    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Process,
      reason: `${input.command} exited ${code}: ${stderr}`,
    });
  }

  return { stdout: running.stdout(), stderr: running.stderr() };
}, Effect.scoped);

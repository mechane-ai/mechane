import { Effect } from 'effect';
import type { ChildProcess } from 'node:child_process';
import { StackStep } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { isProcessExited } from '../processes/is-process-exited.ts';
import { celldLogFailure } from './celld-log-failure.ts';
import { WorkerUnreachable } from './errors.ts';

type ProbeRouteInput = { readonly url: URL; readonly child: ChildProcess; readonly logFile: string };

/** Asks one health route once; fails as celld's own failure when celld has exited. */
export const probeRoute = Effect.fn('probeRoute')(function* ({
  url,
  child,
  logFile,
}: ProbeRouteInput): Effect.fn.Return<void, WorkerUnreachable | StackFailed> {
  if (isProcessExited({ child })) {
    return yield* celldLogFailure({ logFile, step: StackStep.RunCelld, reason: 'celld exited' });
  }

  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(url, { signal }),
    catch: () => new WorkerUnreachable({ url }),
  });

  if (!response.ok) {
    return yield* new WorkerUnreachable({ url });
  }
});

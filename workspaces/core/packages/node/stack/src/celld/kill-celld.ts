import { exitStatusText, startProcess, SUCCESS_STATUS } from '@mechane/program';
import { Duration, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { isProcessExited } from '../processes/is-process-exited.ts';
import { killProcessGroup } from '../processes/kill-process-group.ts';
import { processExit } from '../processes/process-exit.ts';
import type { ChildInput } from '../types.ts';

/** How long the operating system may take to signal celld's child runtime. */
const SIGNAL_TIMEOUT = Duration.seconds(10);

/** pkill reports this status when the supervisor no longer has a child. */
const NO_CHILD_STATUS = 1;

type KillRuntimeInput = { readonly parent: number };

/**
 * celld dev puts its runtime in a separate process group. Kill that direct child before the supervisor, whose
 * parent-death signal reaches the runtime on Linux only. The parent selection never targets another stack.
 */
export const killCelld = Effect.fn('killCelld')(function* ({
  child,
}: ChildInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const parent = Option.fromNullishOr(child.pid);

  if (Option.isNone(parent) || isProcessExited({ child })) {
    return;
  }

  const hadRuntime = yield* killRuntime({ parent: parent.value });

  if (!hadRuntime) {
    yield* killProcessGroup({ child });

    return;
  }

  // Let the supervisor reap the killed runtime before another node opens its state and listener.
  yield* processExit({ child }).pipe(
    Effect.timeoutOrElse({ duration: SIGNAL_TIMEOUT, orElse: () => killProcessGroup({ child }) }),
  );
}, Effect.scoped);

/** Signals only this supervisor's direct children; no match means startup or shutdown left it without a runtime. */
const killRuntime = Effect.fn('killRuntime')(function* ({
  parent,
}: KillRuntimeInput): Effect.fn.Return<boolean, StackFailed, Scope.Scope> {
  const args = ['-KILL', '-P', String(parent)];
  const { exited } = yield* startProcess({ command: 'pkill', args, environment: {}, timeout: SIGNAL_TIMEOUT });

  const run = yield* exited.pipe(
    Effect.mapError((failure) => new StackFailed({ step: StackStep.KillCelld, reason: failure.reason })),
  );

  if (!Option.contains(run.status, SUCCESS_STATUS) && !Option.contains(run.status, NO_CHILD_STATUS)) {
    const status = exitStatusText({ status: run.status });
    const stderr = run.stderr.trim();

    return yield* new StackFailed({ step: StackStep.KillCelld, reason: `pkill exited ${status}: ${stderr}` });
  }

  return Option.contains(run.status, SUCCESS_STATUS);
});

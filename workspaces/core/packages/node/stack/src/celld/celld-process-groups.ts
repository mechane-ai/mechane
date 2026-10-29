import { startProcess, SUCCESS_STATUS } from '@mechane/program';
import { Duration, Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { ChildInput } from '../types.ts';

const integer = Schema.isInt();
const positive = Schema.isGreaterThan(0);
const ProcessGroupId = Schema.NumberFromString.check(integer, positive);

/** The positive process group identifiers printed by the operating system. */
const ProcessGroupIds = Schema.Array(ProcessGroupId);

type ProcessGroupIds = typeof ProcessGroupIds.Type;

const PROCESS_QUERY_TIMEOUT = Duration.seconds(10);

/** Captures the supervisor and its separate runtime group, which can outlive the supervisor on macOS. */
export const celldProcessGroups = Effect.fn('celldProcessGroups')(function* ({
  child,
}: ChildInput): Effect.fn.Return<ReadonlyArray<number>, StackFailed, Scope.Scope> {
  const parent = child.pid;
  const step = StackStep.LockLocalState;
  const args = ['-P', String(parent)];
  const { exited } = yield* startProcess({ command: 'pgrep', args, environment: {}, timeout: PROCESS_QUERY_TIMEOUT });

  const run = yield* exited.pipe(Effect.mapError((failure) => new StackFailed({ step, reason: failure.reason })));

  if (!Option.contains(run.status, SUCCESS_STATUS)) {
    return yield* new StackFailed({ step, reason: 'the serving celld supervisor has no runtime process' });
  }

  const pids = [String(parent), ...run.stdout.trim().split(/\s+/)];

  return yield* Schema.decodeUnknownEffect(ProcessGroupIds)(pids).pipe(
    Effect.mapError(() => new StackFailed({ step, reason: 'pgrep did not return celld process identifiers' })),
  );
}, Effect.scoped);

import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import type { EvalFileFailed } from '../errors.ts';
import { OutFolderBusy } from '../errors.ts';
import type { EvalStore } from '../types.ts';
import { isProcessRunning } from './is-process-running.ts';
import { removeLock } from './remove-lock.ts';

type HoldOutFolderInput = { readonly store: EvalStore };

type TakeLockInput = { readonly lock: EvalStore['lock'] };

/**
 * Holds the out folder's lock for the scope, so one run at a time writes its records, and the scope's end removes it. A
 * lock whose process still runs refuses the run; one whose process no longer runs, as after a crash or a second Ctrl-C,
 * is taken over. Two runs that take over one lock at once could both hold it, and each record's file is still written
 * once.
 */
export const holdOutFolder = Effect.fn('holdOutFolder')(function* ({
  store,
}: HoldOutFolderInput): Effect.fn.Return<void, OutFolderBusy | EvalFileFailed, Scope.Scope> {
  const { lock } = store;
  const taken = takeLock({ lock });
  const removal = removeLock({ path: lock.path });

  // A release: `rm` with `force` refuses only a lock the run does not own.
  yield* Effect.acquireRelease(taken, () => Effect.orDie(removal));
});

/** Writes this process's lock after removing one whose process no longer runs; a running one's lock refuses it. */
const takeLock = Effect.fn('takeLock')(function* ({
  lock,
}: TakeLockInput): Effect.fn.Return<void, OutFolderBusy | EvalFileFailed> {
  const holder = yield* lock.read();

  if (Option.isSome(holder)) {
    const { processId } = holder.value;

    if (yield* isProcessRunning({ processId })) {
      return yield* new OutFolderBusy({ path: lock.path, processId });
    }

    yield* removeLock({ path: lock.path });
  }

  yield* lock.create({ record: { processId: process.pid } });
});

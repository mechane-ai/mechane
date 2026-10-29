import { ReceiptStatus } from '@mechane/sandbox-wire';
import type { ExecutionId, ExecutionReceipt, ExecutionRequest } from '@mechane/sandbox-wire';
import { Deferred, Effect, FiberSet, Option } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import type { AnswerInput, ExecutionLedger, GuestSettings } from '../types.ts';
import { executionGate } from './execution-gate.ts';
import { settleRun } from './settle-run.ts';
import { settledReceipts } from './settled-receipts.ts';
import type { SettledReceipts } from './types.ts';

/** The settings every execution runs with, and the guest's fibers, which every run joins; the first to fail ends it. */
type ExecutionLedgerInput = {
  readonly settings: GuestSettings;
  readonly fibers: FiberSet.FiberSet<void, ExecutionUnstarted>;
};

type ExecutionRunInput = { readonly executionId: ExecutionId; readonly request: ExecutionRequest };

/**
 * Every execution of the machine by id, for the guest's life. A new id starts its run among the guest's fibers, which
 * outlives the request that started it, and a known id joins its run, so no id runs twice. A run that fails ends the
 * guest, so no execution answers that it runs when nothing does.
 */
export function executionLedger({ settings, fibers }: ExecutionLedgerInput): ExecutionLedger {
  const runs = new Map<string, Deferred.Deferred<void>>();
  const receipts = settledReceipts();
  const gate = executionGate();

  const remember: ExecutionRuntime['remember'] = ({ executionId, settled }) => {
    runs.set(executionId, settled);
  };

  const answer = Effect.fn('answer')(function* ({
    executionId,
    request,
    wait,
  }: AnswerInput): Effect.fn.Return<ExecutionReceipt> {
    const isKnown = runs.has(executionId);

    if (gate.isBlocked({ isKnown })) {
      return { state: ReceiptStatus.Running };
    }

    const settled = yield* executionRun({ executionId, request, runs, settings, fibers, receipts, gate, remember });

    yield* Deferred.await(settled).pipe(Effect.timeoutOption(wait));

    return receipts.receipt({ executionId });
  });

  return { answer, quiesce: gate.quiesce, resume: gate.resume };
}

type RememberRunInput = { readonly executionId: ExecutionId; readonly settled: Deferred.Deferred<void> };

type ExecutionRuntime = ExecutionLedgerInput & {
  readonly runs: ReadonlyMap<string, Deferred.Deferred<void>>;
  readonly remember: (input: RememberRunInput) => void;
  readonly receipts: SettledReceipts;
  readonly gate: ReturnType<typeof executionGate>;
};

const executionRun = Effect.fn('executionRun')(function* ({
  executionId,
  request,
  runs,
  settings,
  fibers,
  receipts,
  gate,
  remember,
}: ExecutionRunInput & ExecutionRuntime): Effect.fn.Return<Deferred.Deferred<void>> {
  const existing = runs.get(executionId);
  const known = Option.fromNullishOr(existing);

  if (Option.isSome(known)) {
    return known.value;
  }

  const settled = Deferred.makeUnsafe<void>();

  gate.started();
  remember({ executionId, settled });

  const run = settleRun({ executionId, request, settings, receipts, settled, onSettled: gate.settled });

  yield* FiberSet.run(fibers, run);

  return settled;
});

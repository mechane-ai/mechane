import type { ExecutionId, ExecutionRequest } from '@mechane/sandbox-wire';
import { Deferred, Effect } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import type { GuestSettings } from '../types.ts';
import { runExecution } from './run-execution.ts';
import type { SettledReceipts } from './types.ts';

/** An execution to run once, the receipts to keep its own among, and the run that every request for its id awaits. */
type SettleRunInput = {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest;
  readonly settings: GuestSettings;
  readonly receipts: SettledReceipts;
  readonly settled: Deferred.Deferred<void>;
  readonly onSettled: () => void;
};

/** Runs an execution once, keeps its receipt, and then settles its run. */
export const settleRun = Effect.fn('settleRun')(function* ({
  executionId,
  request,
  settings,
  receipts,
  settled,
  onSettled,
}: SettleRunInput): Effect.fn.Return<void, ExecutionUnstarted> {
  const receipt = yield* runExecution({ executionId, request, settings });

  receipts.keep({ executionId, receipt });
  onSettled();
  yield* Deferred.succeed(settled, undefined);
});

import { Effect, FiberSet, Queue } from 'effect';
import { answerExchange } from './answer-exchange.ts';
import type { ExecutionUnstarted } from './errors.ts';
import type { Exchange, ExecutionLedger, GuestSettings, SourceJournal, WorkspaceJournal } from './types.ts';

/** The queue of requests the server took, and what each answer runs with and among. */
type AnswerNextExchangeInput = {
  readonly exchanges: Queue.Queue<Exchange>;
  readonly fibers: FiberSet.FiberSet<void, ExecutionUnstarted>;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly workspace: WorkspaceJournal;
  readonly source: SourceJournal;
};

/** Takes the next request the server took, and answers it in a fiber of its own among the guest's fibers. */
export const answerNextExchange = Effect.fn('answerNextExchange')(function* ({
  exchanges,
  fibers,
  settings,
  ledger,
  workspace,
  source,
}: AnswerNextExchangeInput): Effect.fn.Return<void> {
  const exchange = yield* Queue.take(exchanges);

  yield* FiberSet.run(fibers, answerExchange({ exchange, settings, ledger, workspace, source }));
});

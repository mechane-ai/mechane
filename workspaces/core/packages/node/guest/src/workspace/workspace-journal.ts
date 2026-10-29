import { HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Deferred, Effect, FiberSet, Option } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { ExecutionLedger, GuestSettings, ServedAnswer, WorkspaceJournal, WorkspaceRequest } from '../types.ts';
import { answerWorkspaceFile } from './answer-workspace-file.ts';
import { completeWorkspaceJob } from './complete-workspace-job.ts';

type WorkspaceJournalInput = {
  readonly folder: string;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly fibers: FiberSet.FiberSet<void, ExecutionUnstarted>;
};

type WorkspaceJob = {
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly result: Deferred.Deferred<ServedAnswer, WorkspaceFailed>;
};

const PENDING: Readonly<ServedAnswer> = { status: HttpStatusCode.NoContent, headers: {}, body: '' };
const FILE_STEPS: ReadonlySet<WorkspaceStep> = new Set([WorkspaceStep.Release, WorkspaceStep.Part]);

/** Archive jobs outlive HTTP polls. Commands remain frozen until the Worker commits and releases their generation. */
export function workspaceJournal({ folder, settings, ledger, fibers }: WorkspaceJournalInput): WorkspaceJournal {
  const state = { job: Option.none<WorkspaceJob>() };

  const answer = Effect.fn('answer')(function* (
    input: WorkspaceRequest,
  ): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
    const { generation, step } = input;

    const isPending: (job: WorkspaceJob) => boolean = (job) => !Deferred.isDoneUnsafe(job.result);
    const isRunning = Option.exists(state.job, isPending);

    if (step === WorkspaceStep.Release && isRunning) {
      return PENDING;
    }

    if (FILE_STEPS.has(step)) {
      return yield* answerWorkspaceFile({ ...input, folder, ledger });
    }

    if (!ledger.quiesce()) {
      return PENDING;
    }

    const known = Option.filter(state.job, (job) => job.generation === generation);

    if (Option.isNone(known)) {
      const result = Deferred.makeUnsafe<ServedAnswer, WorkspaceFailed>();

      state.job = Option.some({ generation, step, result });

      const job = completeWorkspaceJob({ ...input, folder, settings, result });

      yield* FiberSet.run(fibers, job);

      return PENDING;
    }

    return yield* answerKnownJob({ job: known.value, generation, step });
  });

  return { answer };
}

type KnownJobInput = { readonly job: WorkspaceJob; readonly generation: RecordId; readonly step: WorkspaceStep };

const answerKnownJob = Effect.fn('answerKnownJob')(function* ({
  job,
  generation,
  step,
}: KnownJobInput): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  if (job.step !== step) {
    return yield* new WorkspaceFailed({
      generation,
      step,
      reason: 'workspace generation already names another operation',
    });
  }

  if (!Deferred.isDoneUnsafe(job.result)) {
    return PENDING;
  }

  return yield* Deferred.await(job.result);
});

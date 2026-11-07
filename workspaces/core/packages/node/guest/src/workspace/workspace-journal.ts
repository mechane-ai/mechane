import { HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import type { ArchiveMode } from '@mechane/sandbox-wire';
import { Deferred, Effect, FiberSet, Option } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { FreezeLease } from '../quiescence/freeze.types.ts';
import type { ExecutionLedger, GuestSettings, ServedAnswer, WorkspaceJournal, WorkspaceRequest } from '../types.ts';
import { answerWorkspaceFile } from './answer-workspace-file.ts';
import { completeWorkspaceJob } from './complete-workspace-job.ts';

type WorkspaceJournalInput = {
  readonly folder: string;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly fibers: FiberSet.FiberSet<void, ExecutionUnstarted>;
  readonly ownedProcessGroups: () => ReadonlyArray<number>;
  readonly isBusy: () => boolean;
};

type WorkspaceJob = {
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly archiveMode: ArchiveMode;
  readonly result: Deferred.Deferred<ServedAnswer, WorkspaceFailed>;
};

const PENDING: Readonly<ServedAnswer> = { status: HttpStatusCode.NoContent, headers: {}, body: '' };

/** Archive jobs outlive HTTP polls. Commands remain frozen until the Worker commits and releases their generation. */
export function workspaceJournal({
  folder,
  settings,
  ledger,
  fibers,
  ownedProcessGroups,
  isBusy,
}: WorkspaceJournalInput): WorkspaceJournal {
  const state = {
    generation: Option.none<RecordId>(),
    job: Option.none<WorkspaceJob>(),
    freeze: Option.none<FreezeLease>(),
  };

  const answer = Effect.fn('answer')(function* (
    input: WorkspaceRequest,
  ): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
    const { generation, step, archiveMode } = input;

    if (Option.isSome(state.generation) && state.generation.value !== generation) {
      return yield* new WorkspaceFailed({
        generation,
        step,
        reason: 'another workspace generation owns the guest fence',
      });
    }

    const isPending: (job: WorkspaceJob) => boolean = (job) => !Deferred.isDoneUnsafe(job.result);
    const isRunning = Option.exists(state.job, isPending);

    if (step === WorkspaceStep.Release) {
      if (isRunning) {
        return PENDING;
      }

      if (Option.isSome(state.freeze)) {
        yield* state.freeze.value.resume;

        state.freeze = Option.none();
      }

      const released = yield* answerWorkspaceFile({ ...input, folder });

      if (Option.isSome(state.generation)) {
        ledger.resume();
      }

      state.generation = Option.none();
      state.job = Option.none();

      return released;
    }

    if (isBusy() || !ledger.quiesce()) {
      return PENDING;
    }

    state.generation = Option.some(generation);

    if (step === WorkspaceStep.Part) {
      if (isRunning) {
        return PENDING;
      }

      return yield* answerWorkspaceFile({ ...input, folder });
    }

    const known = state.job;

    if (Option.isNone(known)) {
      const result = Deferred.makeUnsafe<ServedAnswer, WorkspaceFailed>();

      state.job = Option.some({ generation, step, archiveMode, result });

      const retainFreeze: (lease: FreezeLease) => void = (lease) => {
        state.freeze = Option.some(lease);
      };

      const job = completeWorkspaceJob({ ...input, folder, settings, result, ownedProcessGroups, retainFreeze });

      yield* FiberSet.run(fibers, job);

      return PENDING;
    }

    return yield* answerKnownJob({ job: known.value, generation, step, archiveMode });
  });

  return { answer };
}

type KnownJobInput = {
  readonly job: WorkspaceJob;
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly archiveMode: ArchiveMode;
};

const answerKnownJob = Effect.fn('answerKnownJob')(function* ({
  job,
  generation,
  step,
  archiveMode,
}: KnownJobInput): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  if (job.step !== step || job.archiveMode !== archiveMode) {
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

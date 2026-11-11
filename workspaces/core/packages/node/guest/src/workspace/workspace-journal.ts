import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { ArchiveMode, WorkspaceStep } from '@mechane/sandbox-wire';
import { Deferred, Effect, Fiber, FiberSet, Option, Schema } from 'effect';
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

/**
 * Archive jobs outlive HTTP polls. Snapshot admission resumes once the immutable copy is ready; drains retain the
 * freeze.
 */
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
    fiber: Option.none<Fiber.Fiber<void>>(),
    releasedThrough: 0,
    lease: 0,
  };

  const answer = Effect.fn('answer')(function* (
    input: WorkspaceRequest,
  ): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
    const { generation, step, archiveMode } = input;

    const schema = Schema.OptionFromUndefinedOr(
      Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
    );

    const lease = yield* Schema.decodeUnknownEffect(schema)(
      input.request.headers[HttpHeader.MechaneCheckpointLease],
    ).pipe(Effect.mapError((cause) => new WorkspaceFailed({ generation, step, reason: cause.message })));

    if (step === WorkspaceStep.Checkpoint && Option.isNone(lease)) {
      return yield* new WorkspaceFailed({ generation, step, reason: 'workspace checkpoint has no lease' });
    }

    if (Option.exists(lease, (value) => value <= state.releasedThrough)) {
      if (step === WorkspaceStep.Release) {
        return { status: HttpStatusCode.Ok, headers: {}, body: '' };
      }

      return yield* new WorkspaceFailed({ generation, step, reason: 'workspace generation was released' });
    }

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
        const capture = Option.exists(
          state.job,
          (job) => job.archiveMode === ArchiveMode.Snapshot && job.step === WorkspaceStep.Checkpoint,
        );

        if (!capture || Option.isNone(state.fiber)) {
          return PENDING;
        }

        yield* Fiber.interrupt(state.fiber.value);
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
      state.fiber = Option.none();
      const releasedLease = Option.getOrElse(lease, () => state.lease);

      state.releasedThrough = Math.max(state.releasedThrough, releasedLease);

      return released;
    }

    if (step === WorkspaceStep.Part && input.request.method === HttpMethod.Get) {
      if (isRunning) {
        return PENDING;
      }

      return yield* answerWorkspaceFile({ ...input, folder });
    }

    const known = state.job;

    if (Option.isSome(known)) {
      const knownAnswer = yield* answerKnownJob({ job: known.value, generation, step, archiveMode });

      if (
        step === WorkspaceStep.Checkpoint &&
        archiveMode === ArchiveMode.Snapshot &&
        knownAnswer.status === HttpStatusCode.Ok
      ) {
        ledger.resume();
      }

      return knownAnswer;
    }

    if (isBusy() || !ledger.quiesce()) {
      return PENDING;
    }

    state.generation = Option.some(generation);
    state.lease = Option.getOrElse(lease, () => state.lease);

    if (step === WorkspaceStep.Part) {
      return yield* answerWorkspaceFile({ ...input, folder });
    }

    const result = Deferred.makeUnsafe<ServedAnswer, WorkspaceFailed>();

    state.job = Option.some({ generation, step, archiveMode, result });

    const retainFreeze: (freeze: FreezeLease) => void = (freeze) => {
      state.freeze = Option.some(freeze);
    };

    const job = completeWorkspaceJob({ ...input, folder, settings, result, ownedProcessGroups, retainFreeze });

    const fiber = yield* FiberSet.run(fibers, job);

    state.fiber = Option.some(fiber);

    return PENDING;
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

import { Micros } from '@mechane/records';
import { Effect, Option, Result } from 'effect';
import type { Scope } from 'effect';
import { EvalRoleStatus } from './application-schemas.ts';
import type {
  CleanupRecord,
  EvalCaseDefinition,
  EvalManifest,
  EvidenceRecord,
  RoleRecord,
} from './application-schemas.ts';
import type {
  EvalTarget,
  EvalTrialSnapshot,
  ResolvedEvalSuite,
  RoleContext,
  RunApplicationEvalInput,
  SavedEval,
} from './application-types.ts';
import { captureEvalResult } from './capture-eval-result.ts';
import { cleanupTrial } from './cleanup/cleanup-trial.ts';
import { EvalOutcome, EvalRole } from './constants.ts';
import { createEvidenceRecord } from './create-evidence-record.ts';
import {
  AllowanceExhausted,
  EvalAdapterFailed,
  EvalAdapterOperation,
  EvalManifestMissing,
  PlanChanged,
} from './errors.ts';
import { failOnInterrupt } from './fail-on-interrupt.ts';
import { gradeEvidence } from './judge/grade-evidence.ts';
import { replySuite } from './judge/reply-suite.ts';
import { freezeApplicationManifest, resolveEvalSuite } from './plan-application.ts';
import { readSuite } from './read-suite.ts';
import { DEFAULT_INSPECTION_OPTIONS, evalInspection } from './report/eval-inspection.ts';
import { inspectionLines } from './report/inspection-lines.ts';
import type { EvalInspection } from './report/inspection-schemas.ts';
import { applicationStore, ensureFreshApplicationStore, readEval } from './store/application-store.ts';
import type { ApplicationStore } from './store/application-store.ts';
import { digestManifest } from './store/encode-eval-records.ts';
import { holdApplicationStore } from './store/hold-application-store.ts';
import { recordTrialFailure } from './store/record-trial-failure.ts';
import { runRole } from './trial/run-role.ts';
import type { EvalRunFailure, WriteProgress } from './types.ts';
import { validateTargetOrigin } from './validate-target-origin.ts';

type EvalRun = {
  readonly outcome: EvalOutcome;
  readonly saved: SavedEval;
  readonly report: EvalInspection;
  readonly lines: ReadonlyArray<string>;
};

type EvalWorkInput = RunApplicationEvalInput & { readonly isResume: boolean };

type RunApplicationTrialInput = {
  readonly suite: ResolvedEvalSuite;
  readonly evalCase: EvalCaseDefinition;
  readonly context: RoleContext;
};

type FinishEvalInput = { readonly store: ApplicationStore };

type CleanupEvalInput = {
  readonly target: EvalTarget;
  readonly outFolder: string;
  readonly writeProgress: WriteProgress;
};

type RunReplyEvalInput = CleanupEvalInput & { readonly suiteFile: string };

type ValidateSavedInput = {
  readonly saved: EvalManifest;
  readonly suite: ResolvedEvalSuite;
  readonly target: EvalTarget;
  readonly path: string;
};

type PreflightAllowanceInput = {
  readonly store: ApplicationStore;
  readonly manifest: EvalManifest;
  readonly target: EvalTarget;
};

const ROLES_PER_TRIAL = 2;

/** Run a frozen suite in a fresh directory, preserving each completed stage independently. */
export const runEval = Effect.fn('runEval')(function* (
  input: RunApplicationEvalInput,
): Effect.fn.Return<EvalRun, EvalRunFailure> {
  const program = evalWork({ ...input, isResume: false });

  return yield* failOnInterrupt({ program, outFolder: input.outFolder });
});

/** Resume only missing stages with the original identities, inputs, and deadlines. */
export const resumeEval = Effect.fn('resumeEval')(function* (
  input: RunApplicationEvalInput,
): Effect.fn.Return<EvalRun, EvalRunFailure> {
  const program = evalWork({ ...input, isResume: true });

  return yield* failOnInterrupt({ program, outFolder: input.outFolder });
});

/** Adapt the reply suite format to the shared execution and structured-grading lifecycle. */
export const runReplyEval = Effect.fn('runReplyEval')(function* ({
  suiteFile,
  target,
  outFolder,
  writeProgress,
}: RunReplyEvalInput): Effect.fn.Return<EvalRun, EvalRunFailure> {
  const definition = yield* readSuite({ path: suiteFile });
  const suite = yield* replySuite({ suite: definition });
  const store = applicationStore({ outFolder });
  const saved = yield* store.manifest.read();
  const input = { suite, target, outFolder, writeProgress };

  if (Option.isSome(saved)) {
    return yield* resumeEval(input);
  }

  return yield* runEval(input);
});

const evalWork = Effect.fn('evalWork')(function* ({
  suite: configuredSuite,
  target,
  outFolder,
  writeProgress,
  isResume,
}: EvalWorkInput): Effect.fn.Return<EvalRun, EvalRunFailure, Scope.Scope> {
  yield* holdApplicationStore({ outFolder });

  const store = applicationStore({ outFolder });
  const saved = yield* store.manifest.read();

  if (isResume && Option.isNone(saved)) {
    return yield* new EvalManifestMissing({ outFolder });
  }

  if (!isResume && Option.isSome(saved)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.StartEval,
      reason: 'The output directory already contains a run; use resume',
    });
  }

  if (!isResume) {
    yield* ensureFreshApplicationStore({ outFolder });
  }

  const suite = yield* resolveEvalSuite({ suite: configuredSuite });

  if (Option.isSome(saved)) {
    yield* validateSaved({ saved: saved.value, suite, target, path: store.manifest.path });

    const records = yield* readEval({ outFolder });

    if (hasFinishedStages({ saved: records })) {
      return yield* finishEval({ store });
    }
  }

  const manifest = yield* freezeApplicationManifest({ store, suite, target });

  yield* preflightAllowance({ store, manifest, target });

  writeProgress({
    line: `Selected ${manifest.trials.length} trials; maximum planned role envelope ${manifest.trials.length * ROLES_PER_TRIAL * suite.definition.bounds.roleCapMicros} micros`,
  });

  // This projection is disposable; every scope exit derives it again from the immutable stage files.
  yield* Effect.acquireRelease(Effect.void, () => finishEval({ store }).pipe(Effect.orDie));

  const records = yield* readEval({ outFolder });
  const pendingTrials = records.trials.filter((snapshot) => !hasFinishedTrial({ snapshot }));

  for (const { trial } of pendingTrials) {
    const files = store.trial({ trialId: trial.id });

    const context: RoleContext = {
      target,
      bounds: manifest.definition.bounds,
      trialId: trial.id,
      files,
      writeProgress,
    };

    const selectedCase = manifest.definition.cases.find((candidate) => candidate.id === trial.caseId);
    const evalCase = Option.fromUndefinedOr(selectedCase);

    if (Option.isNone(evalCase)) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ReadFrozenCase,
        reason: 'The manifest trial names no frozen case',
      });
    }

    const program = runApplicationTrial({ suite, evalCase: evalCase.value, context });
    const result = yield* captureEvalResult({ program });

    if (Result.isFailure(result)) {
      const reason = String(result.failure);

      yield* recordTrialFailure({ files, failure: { stage: 'trial', tag: result.failure._tag, reason } });

      writeProgress({ line: `Trial ${trial.id}: incomplete (${result.failure._tag})` });
    }

    yield* finishEval({ store });
  }

  return yield* finishEval({ store });
}, Effect.scoped);

const runApplicationTrial = Effect.fn('runApplicationTrial')(function* ({
  suite,
  evalCase,
  context,
}: RunApplicationTrialInput): Effect.fn.Return<void, EvalRunFailure, Scope.Scope> {
  yield* Effect.acquireRelease(Effect.void, () => cleanupTrial({ context }).pipe(Effect.orDie));

  const savedSubject = yield* context.files.subject.read();

  const openSubject = Effect.fn('openSubject')(function* (): Effect.fn.Return<RoleRecord, EvalRunFailure, Scope.Scope> {
    if (Option.isSome(savedSubject)) {
      return savedSubject.value;
    }

    const observations = yield* context.files.readObservations();

    const opening = suite.openEnvironment({ visible: evalCase.visible, observations });

    const environment = yield* Effect.acquireRelease(opening, (opened) =>
      opened.release.pipe(
        Effect.catchTags({
          EvalAdapterFailed: (failure) =>
            recordTrialFailure({
              files: context.files,
              failure: { stage: 'cleanup', tag: failure._tag, reason: failure.message },
            }).pipe(Effect.orDie),
        }),
      ),
    );

    context.writeProgress({ line: `Trial ${context.trialId}: subject` });

    const selectedEnvironment = Option.some(environment);
    const connectionName = Option.fromUndefinedOr(suite.definition.connectionName);

    return yield* runRole({
      context,
      role: EvalRole.Subject,
      settings: suite.definition.subject,
      text: evalCase.input,
      tools: suite.definition.tools,
      environment: selectedEnvironment,
      connectionName,
    });
  });

  const subject = yield* openSubject();
  const previousEvidence = yield* context.files.evidence.read();

  const freezeEvidence = Effect.fn('freezeEvidence')(function* (): Effect.fn.Return<EvidenceRecord, EvalRunFailure> {
    if (Option.isSome(previousEvidence)) {
      return previousEvidence.value;
    }

    const observations = yield* context.files.readObservations();
    const collected = yield* suite.collectEvidence({ visible: evalCase.visible, observations, subject });
    const encoded = JSON.stringify(collected);

    if (Buffer.byteLength(encoded) > context.bounds.maxEvidenceBytes) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.FreezeEvidence,
        reason: 'The evidence exceeds the frozen byte bound',
      });
    }

    const complete = collected.isComplete && subject.isEvidenceComplete && subject.status === EvalRoleStatus.Completed;
    const record = createEvidenceRecord({ evidence: { ...collected, isComplete: complete } });

    yield* context.files.evidence.create({ record });

    return record;
  });

  const evidence = yield* freezeEvidence();

  context.writeProgress({ line: `Trial ${context.trialId}: judge` });

  const grade = yield* gradeEvidence({ suite, evidence, rubric: evalCase.rubric, context });
  const savedGrade = yield* context.files.grade.read();

  if (Option.isNone(savedGrade)) {
    yield* context.files.grade.create({ record: grade });
  }
}, Effect.scoped);

const preflightAllowance = Effect.fn('preflightAllowance')(function* ({
  store,
  manifest,
  target,
}: PreflightAllowanceInput): Effect.fn.Return<void, EvalRunFailure> {
  const pending = { roles: 0 };

  for (const trial of manifest.trials) {
    const files = store.trial({ trialId: trial.id });

    const subjectIntent = yield* files.subjectIntent.read();
    const judgeIntent = yield* files.judgeIntent.read();

    if (Option.isNone(subjectIntent)) {
      pending.roles += 1;
    }

    if (Option.isNone(judgeIntent)) {
      pending.roles += 1;
    }
  }

  if (pending.roles === 0) {
    return;
  }

  const { token, workspaceId } = target.access;
  const allowance = yield* target.call({ name: 'showAllowance', input: { workspaceId }, credential: token });
  const neededMicros = Micros.make(pending.roles * manifest.definition.bounds.roleCapMicros);
  const difference = allowance.dailyAllowanceMicros - allowance.committedMicros;
  const availableMicros = Math.max(0, difference);
  const remainingMicros = Micros.make(availableMicros);

  if (neededMicros > remainingMicros) {
    return yield* new AllowanceExhausted({ day: allowance.day, neededMicros, remainingMicros });
  }
});

const validateSaved = Effect.fn('validateSaved')(function* ({
  saved,
  suite,
  target,
  path,
}: ValidateSavedInput): Effect.fn.Return<void, EvalRunFailure> {
  const proposed = {
    version: saved.version,
    definition: suite.definition,
    target: {
      ...saved.target,
      kind: target.kind,
      origin: target.origin.origin,
      workspaceId: target.access.workspaceId,
      artifactIdentity: target.artifactIdentity,
    },
  };

  const savedDigest = digestManifest({ manifest: saved });
  const plannedDigest = digestManifest({ manifest: proposed });

  if (savedDigest !== plannedDigest) {
    return yield* new PlanChanged({ path, savedDigest, plannedDigest });
  }
});

function hasFinishedStages({ saved }: Pick<EvalRun, 'saved'>): boolean {
  return saved.trials.every((snapshot) => hasFinishedTrial({ snapshot }));
}

type HasFinishedTrialInput = { readonly snapshot: EvalTrialSnapshot };
type IsCleanupCompleteInput = { readonly cleanup: ReadonlyArray<CleanupRecord> };

function hasFinishedTrial({ snapshot }: HasFinishedTrialInput): boolean {
  return Option.isSome(snapshot.grade) && isCleanupComplete({ cleanup: snapshot.cleanup });
}

function isCleanupComplete({ cleanup }: IsCleanupCompleteInput): boolean {
  const previous = cleanup.at(-1);
  const last = Option.fromUndefinedOr(previous);

  return Option.isSome(last) && last.value.isComplete;
}

const finishEval = Effect.fn('finishEval')(function* ({
  store,
}: FinishEvalInput): Effect.fn.Return<EvalRun, EvalRunFailure> {
  const saved = yield* readEval({ outFolder: store.outFolder });

  const report = evalInspection({ saved, ...DEFAULT_INSPECTION_OPTIONS });

  yield* store.saveProjection({ projection: report });

  const outcome = evalOutcome({ report });

  return { outcome, saved, report, lines: inspectionLines({ inspection: report }) };
});

function evalOutcome({ report }: Pick<EvalRun, 'report'>): EvalOutcome {
  if (report.completion.isComplete) {
    return EvalOutcome.Completed;
  }

  return EvalOutcome.Incomplete;
}

/** Retry cancellation and resource release without running subjects or judges. */
export const cleanupEval = Effect.fn('cleanupEval')(function* ({
  target,
  outFolder,
  writeProgress,
}: CleanupEvalInput): Effect.fn.Return<SavedEval, EvalRunFailure, Scope.Scope> {
  yield* validateTargetOrigin(target);

  yield* holdApplicationStore({ outFolder });

  const saved = yield* readEval({ outFolder });
  const store = applicationStore({ outFolder });

  if (
    saved.manifest.target.origin !== target.origin.origin ||
    saved.manifest.target.workspaceId !== target.access.workspaceId
  ) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.CleanEval,
      reason: 'Cleanup requires the recorded target origin and workspace',
    });
  }

  for (const trial of saved.manifest.trials) {
    const context: RoleContext = {
      target,
      bounds: saved.manifest.definition.bounds,
      trialId: trial.id,
      files: store.trial({ trialId: trial.id }),
      writeProgress,
    };

    yield* cleanupTrial({ context });
  }

  const finished = yield* finishEval({ store });

  return finished.saved;
}, Effect.scoped);

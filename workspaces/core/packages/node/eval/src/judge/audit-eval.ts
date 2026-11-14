import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import type { EvalAuditManifest, EvalManifest, EvalTrial, EvidenceRecord } from '../application-schemas.ts';
import type {
  ApplicationTrialFiles,
  CollectedEvidence,
  EvalSuite,
  EvalTarget,
  EvalTrialSnapshot,
  Json,
  ResolvedEvalSuite,
  RoleContext,
  SavedEval,
} from '../application-types.ts';
import { cleanupTrial } from '../cleanup/cleanup-trial.ts';
import { EvalAuditKind, EvalRole, EvalScope } from '../constants.ts';
import { createEvidenceRecord } from '../create-evidence-record.ts';
import { createEmptyTrialRecords } from '../empty-trial-records.ts';
import { EvalAdapterFailed, EvalAdapterOperation, PlanChanged } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { buildApplicationManifest, resolveEvalSuite, resolveEvalTarget } from '../plan-application.ts';
import { EvalId } from '../schemas.ts';
import { applicationStore, readEval } from '../store/application-store.ts';
import type { ApplicationStore } from '../store/application-store.ts';
import { encodeSuiteDefinition } from '../store/encode-eval-records.ts';
import { holdApplicationStore } from '../store/hold-application-store.ts';
import { readJudgeRecords } from '../store/read-judge-records.ts';
import { recordTrialFailure } from '../store/record-trial-failure.ts';
import type { EvalRunFailure, WriteProgress } from '../types.ts';
import { gradeEvidence } from './grade-evidence.ts';

/** Encoded judge overrides change only an audit, leaving the source run frozen. */
export type AuditJudge = Pick<EvalSuite['definition']['judge'], 'model' | 'instructions' | 'isSelfGrading'>;

/** Expected judgments are recorded for calibration without entering the judge's input. */
export type CalibrationExample = {
  readonly id: EvalId;
  readonly evidence: CollectedEvidence;
  readonly rubric: Json;
  readonly expected: Json;
};

type AuditEvalInput = {
  readonly suite: EvalSuite;
  readonly target: EvalTarget;
  readonly outFolder: string;
  readonly auditId: EvalId;
  readonly writeProgress: WriteProgress;
};

export type RegradeEvalInput = AuditEvalInput & { readonly judge: AuditJudge };
export type CalibrateEvalInput = AuditEvalInput & { readonly examples: ReadonlyArray<CalibrationExample> };

type FreezeAuditInput = Omit<AuditEvalInput, 'suite'> & {
  readonly suite: ResolvedEvalSuite;
  readonly kind: EvalAuditManifest['kind'];
  readonly sourceDigest: EvalAuditManifest['sourceDigest'];
  readonly store: ApplicationStore;
  readonly trials: Option.Option<ReadonlyArray<EvalTrial>>;
};

type FreezeEvidenceInput = { readonly files: ApplicationTrialFiles; readonly evidence: EvidenceRecord };
type ReadAuditTrialInput = { readonly files: ApplicationTrialFiles; readonly source: EvalTrialSnapshot };
type CalibrationSnapshotInput = { readonly trial: EvalTrial; readonly evidence: EvidenceRecord };
type RegradeTrialInput = { readonly snapshot: EvalTrialSnapshot };
type CalibrationTrialInput = { readonly trial: EvalTrial };

type GradeAuditTrialInput = {
  readonly suite: ResolvedEvalSuite;
  readonly rubric: Json;
  readonly evidence: EvidenceRecord;
  readonly context: RoleContext;
};

/** Regrading reads frozen evidence and writes only beneath its audit's directory. */
export const regradeEval = Effect.fn('regradeEval')(function* ({
  suite: configuredSuite,
  target,
  outFolder,
  auditId,
  judge,
  writeProgress,
}: RegradeEvalInput): Effect.fn.Return<SavedEval, EvalRunFailure, Scope.Scope> {
  yield* holdApplicationStore({ outFolder });

  const suite = yield* resolveEvalSuite({ suite: configuredSuite });
  const source = yield* readEval({ outFolder });
  const originalDefinition = source.manifest.definition;
  const comparableDefinition = { ...suite.definition, judge: originalDefinition.judge };
  const originalConfiguration = encodeSuiteDefinition({ definition: originalDefinition });
  const proposedConfiguration = encodeSuiteDefinition({ definition: comparableDefinition });
  const originalDigest = jsonDigest({ value: originalConfiguration });
  const proposedDigest = jsonDigest({ value: proposedConfiguration });
  const originalSchemaDigest = jsonDigest({ value: originalDefinition.judge.gradeSchema });
  const proposedSchemaDigest = jsonDigest({ value: suite.gradeSchema.definition });

  if (originalDigest !== proposedDigest || originalSchemaDigest !== proposedSchemaDigest) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateRegradeSuite,
      reason: 'Regrading requires the original suite, adapter, evidence schema and private rubrics',
    });
  }

  const gradingConfiguration: EvalSuite = {
    ...configuredSuite,
    definition: {
      ...originalConfiguration,
      judge: { ...judge, nativeTools: [], gradeSchema: suite.gradeSchema.definition },
    },
  };

  const gradingSuite = yield* resolveEvalSuite({ suite: gradingConfiguration });

  const store = applicationStore({ outFolder });
  const selectedTrials = Option.some(source.manifest.trials);
  const sourceDigest = Option.some(source.manifest.digest);

  const audit = yield* freezeAudit({
    suite: gradingSuite,
    target,
    outFolder,
    auditId,
    writeProgress,
    store,
    kind: EvalAuditKind.Regrade,
    sourceDigest,
    trials: selectedTrials,
  });

  const regradeTrial = Effect.fn('regradeTrial')(function* ({
    snapshot,
  }: RegradeTrialInput): Effect.fn.Return<EvalTrialSnapshot, EvalRunFailure> {
    const files = store.audit({ auditId, trialId: snapshot.trial.id });
    const originalEvidence = Option.getOrElse(snapshot.evidence, createMissingEvidence);
    const evidence = yield* freezeEvidence({ files, evidence: originalEvidence });
    const frozenCase = audit.manifest.definition.cases.find((candidate) => candidate.id === snapshot.trial.caseId);
    const evalCase = Option.fromUndefinedOr(frozenCase);

    if (Option.isNone(evalCase)) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.FindAuditCase,
        reason: snapshot.trial.caseId,
      });
    }

    const context: RoleContext = {
      target,
      bounds: audit.manifest.definition.bounds,
      trialId: snapshot.trial.id,
      files,
      writeProgress,
    };

    yield* gradeAuditTrial({ suite: gradingSuite, evidence, rubric: evalCase.value.rubric, context });

    const auditedEvidence = Option.some(evidence);

    return yield* readAuditTrial({ files, source: { ...snapshot, evidence: auditedEvidence } });
  });

  const trials = yield* Effect.forEach(source.trials, (snapshot) => regradeTrial({ snapshot }), { concurrency: 1 });

  return { manifest: audit.manifest, trials, scope: source.scope, isAudit: true };
}, Effect.scoped);

/** Calibration labels are frozen in metadata and never enter the judge's evidence or rubric. */
export const calibrateEval = Effect.fn('calibrateEval')(function* ({
  suite,
  target,
  outFolder,
  auditId,
  examples,
  writeProgress,
}: CalibrateEvalInput): Effect.fn.Return<SavedEval, EvalRunFailure, Scope.Scope> {
  yield* holdApplicationStore({ outFolder });

  const selected = examples.map((example) => ({
    ...example,
    evidence: createEvidenceRecord({ evidence: example.evidence }),
  }));

  const calibrationConfiguration: EvalSuite = {
    ...suite,
    definition: {
      ...suite.definition,
      repeats: 1,
      cases: selected.map((example) => ({
        id: example.id,
        input: 'Judge the frozen evidence.',
        visible: null,
        rubric: example.rubric,
      })),
      components: {
        suite: suite.definition.components,
        calibration: selected.map((example) => ({
          id: example.id,
          evidenceDigest: example.evidence.digest,
          expected: example.expected,
        })),
      },
    },
  };

  const calibrationSuite = yield* resolveEvalSuite({ suite: calibrationConfiguration });

  const store = applicationStore({ outFolder });
  const selectedTrials = Option.none<ReadonlyArray<EvalTrial>>();
  const sourceDigest = Option.none<string>();

  const audit = yield* freezeAudit({
    suite: calibrationSuite,
    target,
    outFolder,
    auditId,
    writeProgress,
    store,
    kind: EvalAuditKind.Calibrate,
    sourceDigest,
    trials: selectedTrials,
  });

  const gradeCalibrationTrial = Effect.fn('gradeCalibrationTrial')(function* ({
    trial,
  }: CalibrationTrialInput): Effect.fn.Return<EvalTrialSnapshot, EvalRunFailure> {
    const selectedExample = selected.find((candidate) => candidate.id === trial.caseId);
    const example = Option.fromUndefinedOr(selectedExample);

    if (Option.isNone(example)) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ValidateCalibrationExamples,
        reason: trial.caseId,
      });
    }

    const files = store.audit({ auditId, trialId: trial.id });
    const evidence = yield* freezeEvidence({ files, evidence: example.value.evidence });

    const context: RoleContext = {
      target,
      bounds: audit.manifest.definition.bounds,
      trialId: trial.id,
      files,
      writeProgress,
    };

    yield* gradeAuditTrial({ suite: calibrationSuite, evidence, rubric: example.value.rubric, context });

    const snapshot = createCalibrationSnapshot({ trial, evidence });

    return yield* readAuditTrial({ files, source: snapshot });
  });

  const trials = yield* Effect.forEach(audit.manifest.trials, (trial) => gradeCalibrationTrial({ trial }), {
    concurrency: 1,
  });

  return { manifest: audit.manifest, trials, scope: EvalScope.JudgeOnly, isAudit: true };
}, Effect.scoped);

const freezeAudit = Effect.fn('freezeAudit')(function* ({
  suite,
  target,
  auditId,
  store,
  kind,
  sourceDigest,
  trials,
}: FreezeAuditInput): Effect.fn.Return<EvalAuditManifest, EvalRunFailure> {
  const id = yield* Schema.decodeUnknownEffect(EvalId, { onExcessProperty: 'error' })(auditId).pipe(
    Effect.mapError(
      (error) => new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateAuditId, reason: error.message }),
    ),
  );

  const identity = yield* resolveEvalTarget({ target });
  const planned = buildApplicationManifest({ definition: suite.definition, target: identity });
  const manifest: EvalManifest = { ...planned, trials: Option.getOrElse(trials, () => planned.trials) };
  const audit: EvalAuditManifest = { kind, id, sourceDigest, manifest };
  const file = store.auditManifest({ auditId: id });
  const previous = yield* file.read();

  if (Option.isSome(previous)) {
    const savedDigest = createAuditDigest({ audit: previous.value });
    const plannedDigest = createAuditDigest({ audit });

    if (savedDigest !== plannedDigest) {
      return yield* new PlanChanged({ path: file.path, savedDigest, plannedDigest });
    }

    return previous.value;
  }

  yield* file.create({ record: audit });

  return audit;
});

type AuditDigestInput = { readonly audit: EvalAuditManifest };

function createAuditDigest({ audit }: AuditDigestInput): string {
  const sourceDigest = Option.getOrNull(audit.sourceDigest);

  return jsonDigest({
    value: {
      kind: audit.kind,
      id: audit.id,
      sourceDigest,
      digest: audit.manifest.digest,
      trials: audit.manifest.trials,
    },
  });
}

const freezeEvidence = Effect.fn('freezeEvidence')(function* ({
  files,
  evidence,
}: FreezeEvidenceInput): Effect.fn.Return<EvidenceRecord, EvalRunFailure> {
  const saved = yield* files.evidence.read();

  if (Option.isSome(saved)) {
    if (saved.value.digest !== evidence.digest) {
      return yield* new PlanChanged({
        path: files.evidence.path,
        savedDigest: saved.value.digest,
        plannedDigest: evidence.digest,
      });
    }

    return saved.value;
  }

  yield* files.evidence.create({ record: evidence });

  return evidence;
});

const gradeAuditTrial = Effect.fn('gradeAuditTrial')(function* ({
  suite,
  evidence,
  rubric,
  context,
}: GradeAuditTrialInput): Effect.fn.Return<void, EvalRunFailure, Scope.Scope> {
  const cleanup = cleanupTrial({ context });
  const reading = context.files.grade.read();

  const previous = yield* Effect.acquireRelease(reading, () => Effect.orDie(cleanup));

  const grading = gradeEvidence({ suite, evidence, rubric, context }).pipe(
    Effect.tapError((failure) => {
      const reason = String(failure);

      return recordTrialFailure({
        files: context.files,
        failure: { stage: EvalRole.Judge, tag: failure._tag, reason },
      });
    }),
  );

  const grade = yield* grading;

  if (Option.isNone(previous)) {
    yield* context.files.grade.create({ record: grade });
  }
}, Effect.scoped);

const readAuditTrial = Effect.fn('readAuditTrial')(function* ({
  files,
  source,
}: ReadAuditTrialInput): Effect.fn.Return<EvalTrialSnapshot, EvalRunFailure> {
  const judgeRecords = yield* readJudgeRecords({ files });

  return { ...source, ...judgeRecords };
});

function createMissingEvidence(): EvidenceRecord {
  return createEvidenceRecord({
    evidence: {
      schema: { id: 'mechane.missing-evidence', version: '1' },
      value: null,
      scope: [],
      isComplete: false,
      issue: 'The source trial has no saved evidence',
    },
  });
}

function createCalibrationSnapshot({ trial, evidence }: CalibrationSnapshotInput): EvalTrialSnapshot {
  const records = createEmptyTrialRecords();
  const savedEvidence = Option.some(evidence);

  return { ...records, trial, evidence: savedEvidence };
}

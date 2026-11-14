import { Array, Option } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { EvalRoleStatus, StructuredGradeStatus } from '../application-schemas.ts';
import type { EvalManifest, RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { EvalTrialSnapshot, SavedEval } from '../application-types.ts';
import type { EvalId } from '../schemas.ts';
import { projectGrade as defaultProjectGrade, summarizeQuality } from './grade-quality.ts';
import type { ProjectGrade } from './grade-quality.ts';
import {
  INSPECTION_VERSION,
  InspectionScope,
  InspectionSource,
  QualityKind,
  StageStatus,
} from './inspection-schemas.ts';
import type {
  EvalCompletion,
  EvalInspection,
  GradeQuality,
  TrialInspection,
  TrialStages,
} from './inspection-schemas.ts';
import { combineRoleSpend, inspectRoleSpend } from './role-spend.ts';

/** Selects displayed trials and lets the suite project its own quality scale. */
export type InspectionOptions = {
  /** None displays every selected trial. */
  readonly caseId: Option.Option<EvalId>;
  readonly projectGrade: ProjectGrade;
};

type EvalInspectionInput = InspectionOptions & { readonly saved: SavedEval };

/** Shows every selected trial and preserves criterion verdicts without imposing a numeric scale. */
export const DEFAULT_INSPECTION_OPTIONS: Readonly<InspectionOptions> = {
  caseId: Option.none(),
  projectGrade: defaultProjectGrade,
};

type InspectTrialInput = {
  readonly snapshot: EvalTrialSnapshot;
  readonly manifest: EvalManifest;
  readonly projectGrade: ProjectGrade;
  readonly scope: InspectionScope;
};

type InspectStagesInput = {
  readonly snapshot: EvalTrialSnapshot;
  readonly manifest: EvalManifest;
  readonly scope: InspectionScope;
};

type InspectRoleStageInput = {
  readonly intent: Option.Option<RoleIntent>;
  readonly receipt: Option.Option<RoleReceipt>;
  readonly record: Option.Option<RoleRecord>;
};

type InspectEvidenceStageInput = { readonly snapshot: EvalTrialSnapshot; readonly subject: StageStatus };
type InspectGradingStageInput = { readonly snapshot: EvalTrialSnapshot; readonly issues: ReadonlyArray<string> };
type InspectCleanupStageInput = { readonly snapshot: EvalTrialSnapshot; readonly subject: StageStatus };
type InspectGradeIssuesInput = { readonly snapshot: EvalTrialSnapshot; readonly manifest: EvalManifest };

type InspectQualityInput = {
  readonly snapshot: EvalTrialSnapshot;
  readonly stages: TrialStages;
  readonly projectGrade: ProjectGrade;
  readonly scope: InspectionScope;
};

type ResolveStageFailureInput = { readonly stage: StageStatus; readonly hasFailure: boolean };
type SummarizeCompletionInput = { readonly trials: ReadonlyArray<TrialInspection>; readonly scope: InspectionScope };
type AuditNoticesInput = { readonly isAudit: boolean };

/** Derives completion and quality while retaining cleanup failures and unknown accounting. */
export function evalInspection({ saved, caseId, projectGrade }: EvalInspectionInput): EvalInspection {
  const { scope, isAudit } = saved;

  const trials = saved.trials.map((snapshot) =>
    inspectTrial({ snapshot, manifest: saved.manifest, projectGrade, scope }),
  );

  const selectedTrials = Option.match(caseId, {
    onNone: () => trials,
    onSome: (selected) => trials.filter((trial) => trial.caseId === selected),
  });

  const subjectSpends = trials.map((trial) => trial.subjectSpend);
  const judgeSpends = trials.map((trial) => trial.judgeSpend);
  const qualities = trials.map((trial) => trial.quality);

  return {
    version: INSPECTION_VERSION,
    source: InspectionSource.Records,
    scope,
    isResumable: !isAudit && scope === InspectionScope.Full,
    suiteId: saved.manifest.definition.id,
    digest: Option.some(saved.manifest.digest),
    manifest: Option.some(saved.manifest),
    completion: summarizeCompletion({ trials, scope }),
    subjectSpend: combineRoleSpend({ spends: subjectSpends }),
    judgeSpend: combineRoleSpend({ spends: judgeSpends }),
    quality: summarizeQuality({ qualities }),
    trials: selectedTrials,
    notices: auditNotices({ isAudit }),
    historicalDefinition: Option.none(),
  };
}

function inspectTrial({ snapshot, manifest, projectGrade, scope }: InspectTrialInput): TrialInspection {
  const savedStages = inspectStages({ snapshot, manifest, scope });
  const quality = inspectQuality({ snapshot, stages: savedStages, projectGrade, scope });
  const isSubjectComplete = scope === InspectionScope.JudgeOnly || savedStages.subject === StageStatus.Completed;

  const hasExpectedGrade =
    isSubjectComplete &&
    savedStages.evidence === StageStatus.Completed &&
    savedStages.grading === StageStatus.Completed;

  const stages: TrialStages = (() => {
    if (hasExpectedGrade && quality.kind === QualityKind.Unavailable) {
      return {
        ...savedStages,
        grading: StageStatus.Failed,
        isComplete: false,
        issues: [...savedStages.issues, 'The suite could not project the saved structured grade.'],
      };
    }

    return savedStages;
  })();

  const frozenCase = Array.findFirst(manifest.definition.cases, (evalCase) => evalCase.id === snapshot.trial.caseId);

  const judge = Option.orElse(snapshot.judge, () =>
    Option.flatMap(snapshot.grade, (grade) => Option.fromUndefinedOr(grade.judge)),
  );

  return {
    ...snapshot.trial,
    stages,
    subjectSpend: inspectRoleSpend({
      intent: snapshot.subjectIntent,
      receipt: snapshot.subjectReceipt,
      record: snapshot.subject,
    }),
    judgeSpend: inspectRoleSpend({ intent: snapshot.judgeIntent, receipt: snapshot.judgeReceipt, record: judge }),
    quality,
    frozenCase,
    subjectIntent: snapshot.subjectIntent,
    subjectReceipt: snapshot.subjectReceipt,
    subject: snapshot.subject,
    observations: snapshot.observations,
    evidence: snapshot.evidence,
    judgeIntent: snapshot.judgeIntent,
    judgeReceipt: snapshot.judgeReceipt,
    judge,
    submission: snapshot.submission,
    grade: snapshot.grade,
    cleanup: snapshot.cleanup,
    failures: snapshot.failures,
    historicalRecord: Option.none(),
  };
}

function auditNotices({ isAudit }: AuditNoticesInput): ReadonlyArray<string> {
  if (isAudit) {
    return ['This is a saved judge audit. Original grades and subject outputs are unchanged.'];
  }

  return [];
}

function inspectStages({ snapshot, manifest, scope }: InspectStagesInput): TrialStages {
  const hasFailure = snapshot.failures.length > 0;

  const observedSubject = inspectRoleStage({
    intent: snapshot.subjectIntent,
    receipt: snapshot.subjectReceipt,
    record: snapshot.subject,
  });

  const subject = resolveStageFailure({
    stage: observedSubject,
    hasFailure: hasFailure && scope === InspectionScope.Full,
  });

  const observedEvidence = inspectEvidenceStage({ snapshot, subject });

  const evidence = resolveStageFailure({
    stage: observedEvidence,
    hasFailure: hasFailure && (scope === InspectionScope.JudgeOnly || subject === StageStatus.Completed),
  });

  const gradeIssues = inspectGradeIssues({ snapshot, manifest });
  const observedGrading = inspectGradingStage({ snapshot, issues: gradeIssues });

  const grading = resolveStageFailure({
    stage: observedGrading,
    hasFailure: hasFailure && evidence === StageStatus.Completed,
  });

  const cleanup = inspectCleanupStage({ snapshot, subject });

  const requiredStages: ReadonlyArray<StageStatus> = (() => {
    if (scope === InspectionScope.JudgeOnly) {
      return [evidence, grading, cleanup];
    }

    return [subject, evidence, grading, cleanup];
  })();

  const subjectIssue = Option.flatMap(snapshot.subject, (record) => Option.fromUndefinedOr(record.issue));
  const evidenceIssue = Option.flatMap(snapshot.evidence, (record) => Option.fromUndefinedOr(record.issue));
  const gradeIssue = Option.flatMap(snapshot.grade, (record) => Option.fromUndefinedOr(record.issue));

  const issues = [
    ...Option.toArray(subjectIssue),
    ...Option.toArray(evidenceIssue),
    ...Option.toArray(gradeIssue),
    ...gradeIssues,
  ];

  return {
    subject,
    evidence,
    grading,
    cleanup,
    isComplete: requiredStages.every((stage) => stage === StageStatus.Completed),
    issues,
  };
}

function inspectRoleStage({ intent, receipt, record }: InspectRoleStageInput): StageStatus {
  if (Option.isSome(record)) {
    switch (record.value.status) {
      case EvalRoleStatus.Completed:
        return StageStatus.Completed;
      case EvalRoleStatus.Failed:
        return StageStatus.Failed;
      case EvalRoleStatus.Cancelled:
        return StageStatus.Cancelled;
    }
  }

  if (Option.isSome(intent) || Option.isSome(receipt)) {
    return StageStatus.Pending;
  }

  return StageStatus.NotStarted;
}

function inspectEvidenceStage({ snapshot, subject }: InspectEvidenceStageInput): StageStatus {
  if (Option.isSome(snapshot.subject) && !snapshot.subject.value.isEvidenceComplete) {
    return StageStatus.Ungradable;
  }

  if (Option.isSome(snapshot.evidence)) {
    if (snapshot.evidence.value.isComplete) {
      return StageStatus.Completed;
    }

    return StageStatus.Ungradable;
  }

  if (subject === StageStatus.Completed) {
    return StageStatus.Pending;
  }

  return StageStatus.NotStarted;
}

function inspectGradingStage({ snapshot, issues }: InspectGradingStageInput): StageStatus {
  if (issues.length > 0) {
    return StageStatus.Failed;
  }

  if (Option.isSome(snapshot.grade)) {
    switch (snapshot.grade.value.status) {
      case StructuredGradeStatus.Graded:
        return StageStatus.Completed;
      case StructuredGradeStatus.Ungradable:
        return StageStatus.Ungradable;
      case StructuredGradeStatus.Failed:
        if (Option.isSome(snapshot.judge) && snapshot.judge.value.status === EvalRoleStatus.Cancelled) {
          return StageStatus.Cancelled;
        }

        return StageStatus.Failed;
    }
  }

  return inspectRoleStage({ intent: snapshot.judgeIntent, receipt: snapshot.judgeReceipt, record: snapshot.judge });
}

function inspectCleanupStage({ snapshot, subject }: InspectCleanupStageInput): StageStatus {
  const attempts = snapshot.cleanup.toSorted((left, right) => left.attempt - right.attempt);
  const latest = Array.last(attempts);

  if (Option.isSome(latest)) {
    if (latest.value.isComplete && latest.value.errors.length === 0) {
      return StageStatus.Completed;
    }

    return StageStatus.Failed;
  }

  const hasJudgeIntent = Option.isSome(snapshot.judgeIntent) || Option.isSome(snapshot.judgeReceipt);
  const hasJudgeWork = hasJudgeIntent || Option.isSome(snapshot.judge);

  if (subject === StageStatus.NotStarted && !hasJudgeWork) {
    return StageStatus.NotStarted;
  }

  return StageStatus.Pending;
}

function inspectGradeIssues({ snapshot, manifest }: InspectGradeIssuesInput): ReadonlyArray<string> {
  if (Option.isNone(snapshot.grade)) {
    if (Option.isSome(snapshot.judge) && snapshot.judge.value.status === EvalRoleStatus.Completed) {
      return ['The judge completed without a saved structured grade.'];
    }

    return [];
  }

  if (snapshot.grade.value.status !== StructuredGradeStatus.Graded) {
    return [];
  }

  const grade = snapshot.grade.value;
  const gradeValue = Option.fromUndefinedOr(grade.value);

  const valueIssues: ReadonlyArray<string> = (() => {
    if (Option.isNone(gradeValue)) {
      return ['The graded record has no structured grade.'];
    }

    return [];
  })();

  const evidenceIssues: ReadonlyArray<string> = (() => {
    if (Option.isNone(snapshot.evidence)) {
      return ['The grade has no saved evidence bundle.'];
    }

    if (!snapshot.evidence.value.isComplete) {
      return ['The grade names incomplete evidence.'];
    }

    if (grade.evidenceDigest !== snapshot.evidence.value.digest) {
      return ['The grade names a different evidence digest.'];
    }

    return [];
  })();

  const schemaIssues: ReadonlyArray<string> = (() => {
    if (!isDeepStrictEqual(grade.schema, manifest.definition.judge.gradeSchema)) {
      return ['The grade uses a different schema from the manifest.'];
    }

    return [];
  })();

  return [...valueIssues, ...evidenceIssues, ...schemaIssues];
}

function inspectQuality({ snapshot, stages, projectGrade, scope }: InspectQualityInput): GradeQuality {
  if (scope === InspectionScope.Full && stages.subject !== StageStatus.Completed) {
    return { kind: QualityKind.Unavailable };
  }

  if (stages.evidence !== StageStatus.Completed || stages.grading !== StageStatus.Completed) {
    return { kind: QualityKind.Unavailable };
  }

  const value = Option.flatMap(snapshot.grade, (grade) => Option.fromUndefinedOr(grade.value));

  return Option.match(value, {
    onNone: () => ({ kind: QualityKind.Unavailable }),
    onSome: (grade) => projectGrade({ value: grade }),
  });
}

const PENDING_STAGES: ReadonlySet<StageStatus> = new Set([StageStatus.NotStarted, StageStatus.Pending]);

const FAILED_STAGES: ReadonlySet<StageStatus> = new Set([
  StageStatus.Failed,
  StageStatus.Cancelled,
  StageStatus.Ungradable,
]);

function resolveStageFailure({ stage, hasFailure }: ResolveStageFailureInput): StageStatus {
  if (hasFailure && PENDING_STAGES.has(stage)) {
    return StageStatus.Failed;
  }

  return stage;
}

export function summarizeCompletion({ trials, scope }: SummarizeCompletionInput): EvalCompletion {
  const pendingTrials = trials.filter((trial) => {
    const stages: ReadonlyArray<StageStatus> = (() => {
      if (scope === InspectionScope.JudgeOnly) {
        return [trial.stages.evidence, trial.stages.grading, trial.stages.cleanup];
      }

      return [trial.stages.subject, trial.stages.evidence, trial.stages.grading, trial.stages.cleanup];
    })();

    return !stages.some((stage) => FAILED_STAGES.has(stage)) && stages.some((stage) => PENDING_STAGES.has(stage));
  });

  return {
    isComplete: trials.length > 0 && trials.every((trial) => trial.stages.isComplete),
    selectedTrials: trials.length,
    completedTrials: trials.filter((trial) => trial.stages.isComplete).length,
    subjectCompletedTrials: trials.filter((trial) => trial.stages.subject === StageStatus.Completed).length,
    gradedTrials: trials.filter((trial) => trial.quality.kind !== QualityKind.Unavailable).length,
    cleanupCompletedTrials: trials.filter((trial) => trial.stages.cleanup === StageStatus.Completed).length,
    subjectFailedTrials: trials.filter((trial) => trial.stages.subject === StageStatus.Failed).length,
    judgeFailedTrials: trials.filter((trial) => trial.stages.grading === StageStatus.Failed).length,
    cancelledTrials: trials.filter(
      (trial) => trial.stages.subject === StageStatus.Cancelled || trial.stages.grading === StageStatus.Cancelled,
    ).length,
    ungradableTrials: trials.filter(
      (trial) => trial.stages.evidence === StageStatus.Ungradable || trial.stages.grading === StageStatus.Ungradable,
    ).length,
    pendingTrials: pendingTrials.length,
  };
}

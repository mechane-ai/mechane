import { Micros, Tokens } from '@mechane/records';
import { Array, Effect, Option, Schema } from 'effect';
import { EvalTrial, EvalTrialId } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import { CriterionVerdict, EvalFileStep, TrialVerdict } from '../constants.ts';
import { createEmptyTrialRecords } from '../empty-trial-records.ts';
import { EvalFileFailed } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { EvalId } from '../schemas.ts';
import { readHistoricalReport, readHistoricalTrial } from '../store/historical-records.ts';
import { trialId } from '../trial-id.ts';
import { summarizeCompletion } from './eval-inspection.ts';
import { summarizeQuality } from './grade-quality.ts';
import {
  INSPECTION_VERSION,
  InspectionScope,
  InspectionSource,
  QualityKind,
  StageStatus,
} from './inspection-schemas.ts';
import type { EvalInspection, GradeQuality, RoleSpend, TrialInspection, TrialStages } from './inspection-schemas.ts';
import { combineRoleSpend } from './role-spend.ts';

const HISTORICAL_SUNDIAL_FORMAT = 1;
const HISTORICAL_TURN_REPORT_VERSION = 2;
const HISTORICAL_NOTIFICATION_REPORT_VERSION = 3;

const HISTORICAL_MECHANE_VERSIONS = [
  1,
  HISTORICAL_TURN_REPORT_VERSION,
  HISTORICAL_NOTIFICATION_REPORT_VERSION,
] as const;

const HISTORICAL_NUMERIC_SCALE = 'sundial-planner-v1';
const HistoricalScore = { Zero: 0, Partial: 0.5, Full: 1 } as const;

const HistoricalSundialStatus = { Graded: 'graded', Failed: 'failed' } as const;
const HistoricalSundialStage = { Agent: 'agent', Judge: 'judge', Cleanup: 'cleanup', Complete: 'complete' } as const;

const CriterionVerdictValue = Schema.Enum(CriterionVerdict);
const hasCriterionVerdict = Schema.is(CriterionVerdictValue);

const HistoricalSundialGrade = Schema.Struct({
  score: Schema.Enum(HistoricalScore),
  reason: Schema.String,
  problems: Schema.Array(Schema.String),
});

type HistoricalSundialGrade = typeof HistoricalSundialGrade.Type;

const HistoricalSundialResult = Schema.Struct({
  caseID: EvalId,
  repeat: Schema.Int,
  status: Schema.Enum(HistoricalSundialStatus),
  stage: Schema.Enum(HistoricalSundialStage),
  grade: Schema.OptionFromNullOr(HistoricalSundialGrade),
  error: Schema.OptionFromNullOr(Schema.String),
});

type HistoricalSundialResult = typeof HistoricalSundialResult.Type;

const HistoricalScenario = Schema.Struct({ id: EvalId, snapshot: Schema.Json, rubric: Schema.String });

type HistoricalScenario = typeof HistoricalScenario.Type;

const HistoricalSundialReport = Schema.StructWithRest(
  Schema.Struct({
    format: Schema.Literal(HISTORICAL_SUNDIAL_FORMAT),
    model: Schema.String,
    judgeModel: Schema.String,
    repeats: Schema.Int.check(Schema.isGreaterThan(0)),
    scenarios: Schema.Array(HistoricalScenario),
    results: Schema.Array(HistoricalSundialResult),
    runError: Schema.OptionFromNullOr(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Json)],
);

type HistoricalSundialReport = typeof HistoricalSundialReport.Type;

const HistoricalMechaneTrial = Schema.Struct({
  id: EvalTrial.fields.id,
  case_id: EvalId,
  repeat: Schema.Int,
  verdict: Schema.Enum(TrialVerdict),
  subject_charged_micros: Schema.OptionFromOptionalKey(Micros),
  grader_charged_micros: Schema.OptionFromOptionalKey(Micros),
});

type HistoricalMechaneTrial = typeof HistoricalMechaneTrial.Type;

const HistoricalMechaneReport = Schema.StructWithRest(
  Schema.Struct({
    version: Schema.Literals(HISTORICAL_MECHANE_VERSIONS),
    suite_id: EvalId,
    digest: Schema.String,
    trials: Schema.Array(HistoricalMechaneTrial),
  }),
  [Schema.Record(Schema.String, Schema.Json)],
);

type HistoricalMechaneReport = typeof HistoricalMechaneReport.Type;

const SundialFormat = Schema.Struct({ format: Schema.Literal(HISTORICAL_SUNDIAL_FORMAT) });
const MechaneFormat = Schema.Struct({ version: Schema.Literals(HISTORICAL_MECHANE_VERSIONS) });

type ReadHistoricalEvalInput = { readonly outFolder: string; readonly caseId: Option.Option<EvalId> };

type DecodeHistoricalReportInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly schema: S;
  readonly value: Json;
  readonly outFolder: string;
};

type SundialInspectionInput = ReadHistoricalEvalInput & {
  readonly report: HistoricalSundialReport;
  readonly raw: Json;
};

type MechaneInspectionInput = {
  readonly report: HistoricalMechaneReport;
  readonly raw: Json;
  readonly caseId: Option.Option<EvalId>;
};

type HistoricalSundialTrialInput = {
  readonly scenario: HistoricalScenario;
  readonly repeat: number;
  readonly result: Option.Option<HistoricalSundialResult>;
  readonly outFolder: string;
  readonly reportDigest: string;
};

type HistoricalSundialStagesInput = { readonly result: Option.Option<HistoricalSundialResult> };
type HistoricalMechaneTrialInput = { readonly trial: HistoricalMechaneTrial };

type EmptyHistoricalTrialInput = EvalTrial & {
  readonly stages: TrialStages;
  readonly quality: GradeQuality;
  readonly historicalRecord: Option.Option<Json>;
};

type HistoricalSpendInput = { readonly identity: string; readonly charge: Option.Option<Micros> };

type HistoricalInspectionInput = {
  readonly suiteId: EvalId;
  readonly digest: Option.Option<string>;
  readonly source: InspectionSource;
  readonly raw: Json;
  readonly trials: ReadonlyArray<TrialInspection>;
  readonly caseId: Option.Option<EvalId>;
  readonly notices: ReadonlyArray<string>;
};

export const readHistoricalEval = Effect.fn('readHistoricalEval')(function* ({
  outFolder,
  caseId,
}: ReadHistoricalEvalInput): Effect.fn.Return<EvalInspection, EvalFileFailed> {
  const raw = yield* readHistoricalReport({ outFolder });

  if (Option.isNone(raw)) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Read,
      path: outFolder,
      reason: 'no manifest or historical report exists',
    });
  }

  if (Schema.is(SundialFormat)(raw.value)) {
    const report = yield* decodeHistoricalReport({ schema: HistoricalSundialReport, value: raw.value, outFolder });

    return yield* sundialInspection({ report, raw: raw.value, outFolder, caseId });
  }

  if (Schema.is(MechaneFormat)(raw.value)) {
    const report = yield* decodeHistoricalReport({ schema: HistoricalMechaneReport, value: raw.value, outFolder });

    return mechaneInspection({ report, raw: raw.value, caseId });
  }

  return yield* new EvalFileFailed({
    step: EvalFileStep.Decode,
    path: outFolder,
    reason: 'the historical report format is unsupported or invalid',
  });
});

const decodeHistoricalReport = Effect.fn('decodeHistoricalReport')(function* <
  S extends Schema.Codec<unknown, unknown>,
>({ schema, value, outFolder }: DecodeHistoricalReportInput<S>): Effect.fn.Return<S['Type'], EvalFileFailed> {
  return yield* Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(value).pipe(
    Effect.mapError(
      (error) => new EvalFileFailed({ step: EvalFileStep.Decode, path: outFolder, reason: error.message }),
    ),
  );
});

const sundialInspection = Effect.fn('sundialInspection')(function* ({
  report,
  raw,
  outFolder,
  caseId,
}: SundialInspectionInput): Effect.fn.Return<EvalInspection, EvalFileFailed> {
  const repeats = Array.range(1, report.repeats);
  const reportDigest = jsonDigest({ value: raw });
  const selected = report.scenarios.flatMap((scenario) => repeats.map((repeat) => ({ scenario, repeat })));

  const trials = yield* Effect.forEach(
    selected,
    ({ scenario, repeat }) => {
      const result = Array.findFirst(
        report.results,
        (saved) => saved.caseID === scenario.id && saved.repeat === repeat,
      );

      return historicalSundialTrial({ scenario, repeat, result, outFolder, reportDigest });
    },
    { concurrency: 1 },
  );

  const digest = Option.none<string>();
  const runErrors = Option.toArray(report.runError);

  const notices = [
    'Historical Sundial format 1 is read-only and has no resumable stage records.',
    'Its fixture receipts establish capture only. New production validation and evidence guarantees are unavailable.',
    'Cleanup and complete usage accounting cannot be established from this historical report.',
    ...runErrors,
  ];

  return historicalInspection({
    suiteId: 'sundial-planner',
    digest,
    source: InspectionSource.HistoricalSundial,
    raw,
    trials,
    caseId,
    notices,
  });
});

const historicalSundialTrial = Effect.fn('historicalSundialTrial')(function* ({
  scenario,
  repeat,
  result,
  outFolder,
  reportDigest,
}: HistoricalSundialTrialInput): Effect.fn.Return<TrialInspection, EvalFileFailed> {
  const identifier = trialId({ digest: reportDigest, caseId: scenario.id, repeat });
  const id = EvalTrialId.make(identifier);
  const savedRecord = yield* readHistoricalTrial({ outFolder, caseId: scenario.id, repeat });
  const originalTrial = Option.getOrNull(savedRecord);
  const historicalRecord = Option.some({ frozenCase: scenario, trial: originalTrial });
  const grade = Option.flatMap(result, (saved) => saved.grade);

  const quality: GradeQuality = Option.match(grade, {
    onNone: () => ({ kind: QualityKind.Unavailable }),
    onSome: (saved) => ({ kind: QualityKind.Numeric, scaleId: HISTORICAL_NUMERIC_SCALE, score: saved.score }),
  });

  const stages = historicalSundialStages({ result });

  return emptyHistoricalTrial({ id, caseId: scenario.id, repeat, stages, quality, historicalRecord });
});

function historicalSundialStages({ result }: HistoricalSundialStagesInput): TrialStages {
  if (Option.isNone(result)) {
    return {
      subject: StageStatus.NotStarted,
      evidence: StageStatus.Unknown,
      grading: StageStatus.NotStarted,
      cleanup: StageStatus.Unknown,
      isComplete: false,
      issues: [],
    };
  }

  const subject: StageStatus = (() => {
    if (result.value.stage === HistoricalSundialStage.Agent) {
      return StageStatus.Failed;
    }

    return StageStatus.Completed;
  })();

  const grading: StageStatus = (() => {
    if (Option.isSome(result.value.grade)) {
      return StageStatus.Completed;
    }

    if (result.value.stage === HistoricalSundialStage.Judge) {
      return StageStatus.Failed;
    }

    return StageStatus.NotStarted;
  })();

  const cleanup: StageStatus = (() => {
    if (result.value.stage === HistoricalSundialStage.Cleanup) {
      return StageStatus.Failed;
    }

    return StageStatus.Unknown;
  })();

  return {
    subject,
    evidence: StageStatus.Unknown,
    grading,
    cleanup,
    isComplete: false,
    issues: Option.toArray(result.value.error),
  };
}

function mechaneInspection({ report, raw, caseId }: MechaneInspectionInput): EvalInspection {
  const trials = report.trials.map((trial) => historicalMechaneTrial({ trial }));
  const digest = Option.some(report.digest);

  return historicalInspection({
    suiteId: report.suite_id,
    digest,
    source: InspectionSource.HistoricalMechane,
    raw,
    trials,
    caseId,
    notices: [
      'Historical Mechane reports are read-only summaries. Stage completion, cleanup, frozen inputs, and complete usage accounting are unavailable.',
    ],
  });
}

function historicalMechaneTrial({ trial }: HistoricalMechaneTrialInput): TrialInspection {
  const quality: GradeQuality = (() => {
    if (hasCriterionVerdict(trial.verdict)) {
      return { kind: QualityKind.Criteria, verdict: trial.verdict, criteria: Option.none() };
    }

    return { kind: QualityKind.Unavailable };
  })();

  const stages: TrialStages = {
    subject: StageStatus.Unknown,
    evidence: StageStatus.Unknown,
    grading: StageStatus.Unknown,
    cleanup: StageStatus.Unknown,
    isComplete: false,
    issues: [],
  };

  const historicalRecord = Option.none<Json>();

  const inspection = emptyHistoricalTrial({
    id: trial.id,
    caseId: trial.case_id,
    repeat: trial.repeat,
    stages,
    quality,
    historicalRecord,
  });

  return {
    ...inspection,
    subjectSpend: historicalSpend({ identity: trial.id, charge: trial.subject_charged_micros }),
    judgeSpend: historicalSpend({ identity: trial.id, charge: trial.grader_charged_micros }),
  };
}

function historicalInspection({
  suiteId,
  digest,
  source,
  raw,
  trials,
  caseId,
  notices,
}: HistoricalInspectionInput): EvalInspection {
  const subjectSpends = trials.map((trial) => trial.subjectSpend);
  const judgeSpends = trials.map((trial) => trial.judgeSpend);
  const qualities = trials.map((trial) => trial.quality);

  const selectedTrials = Option.match(caseId, {
    onNone: () => trials,
    onSome: (selected) => trials.filter((trial) => trial.caseId === selected),
  });

  return {
    version: INSPECTION_VERSION,
    source,
    scope: InspectionScope.Full,
    isResumable: false,
    suiteId,
    digest,
    manifest: Option.none(),
    completion: summarizeCompletion({ trials, scope: InspectionScope.Full }),
    subjectSpend: combineRoleSpend({ spends: subjectSpends }),
    judgeSpend: combineRoleSpend({ spends: judgeSpends }),
    quality: summarizeQuality({ qualities }),
    trials: selectedTrials,
    notices,
    historicalDefinition: Option.some(raw),
  };
}

function emptyHistoricalTrial({
  id,
  caseId,
  repeat,
  stages,
  quality,
  historicalRecord,
}: EmptyHistoricalTrialInput): TrialInspection {
  const charge = Option.none<Micros>();
  const spend = historicalSpend({ identity: id, charge });
  const records = createEmptyTrialRecords();

  return {
    ...records,
    id,
    caseId,
    repeat,
    stages,
    quality,
    historicalRecord,
    subjectSpend: spend,
    judgeSpend: spend,
    frozenCase: Option.none(),
  };
}

function historicalSpend({ identity, charge }: HistoricalSpendInput): RoleSpend {
  return {
    knownChargedMicros: Option.getOrElse(charge, () => Micros.make(0)),
    isComplete: false,
    unknownAttempts: [identity],
    knownInputTokens: Tokens.make(0),
    knownOutputTokens: Tokens.make(0),
    knownCacheReadTokens: Tokens.make(0),
    knownCacheWriteTokens: Tokens.make(0),
    unknownUsageAttempts: [identity],
  };
}

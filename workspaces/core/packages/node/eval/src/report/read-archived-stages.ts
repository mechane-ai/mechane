import { Micros, Tokens } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import { EvalTrial, StructuredGradeStatus } from '../application-schemas.ts';
import { EvalFileStep } from '../constants.ts';
import { createEmptyTrialRecords } from '../empty-trial-records.ts';
import { EvalFileFailed } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { EvalId } from '../schemas.ts';
import { ApplicationFile } from '../store/constants.ts';
import { readArchivedTrialFiles, readHistoricalReport } from '../store/historical-records.ts';
import { onceFile } from '../store/once-file.ts';
import { summarizeTrials } from './eval-inspection.ts';
import type { InspectionOptions } from './eval-inspection.ts';
import {
  GradeQuality,
  INSPECTION_VERSION,
  InspectionScope,
  InspectionSource,
  QualityKind,
  StageStatus,
  TrialStages,
} from './inspection-schemas.ts';
import type { EvalInspection, RoleSpend, TrialInspection } from './inspection-schemas.ts';

type ReadArchivedInput = InspectionOptions & { readonly outFolder: string };
const VERSION = 3;
const PROJECTION_VERSION = 1;
const ArchivedGrade = Schema.Struct({ status: Schema.Literal(StructuredGradeStatus.Graded), value: Schema.Json });

const NativeManifest = Schema.Struct({
  version: Schema.Literal(VERSION),
  digest: Schema.String,
  definition: Schema.Record(Schema.String, Schema.Json),
  target: Schema.Json,
  trials: Schema.Array(EvalTrial),
});

const Audit = Schema.Struct({ manifest: NativeManifest });

const OlderRoleSpend = Schema.Struct({
  knownChargedMicros: Micros,
  isComplete: Schema.Boolean,
  unknownAttempts: Schema.Array(Schema.String),
  knownInputTokens: Tokens,
  knownOutputTokens: Tokens,
  knownCacheReadTokens: Tokens,
  knownCacheWriteTokens: Tokens,
  unknownUsageAttempts: Schema.Array(Schema.String),
});

const PriorTrial = Schema.Struct({
  id: EvalTrial.fields.id,
  caseId: EvalId,
  repeat: Schema.Int,
  stages: TrialStages,
  quality: GradeQuality,
  subjectSpend: OlderRoleSpend,
  judgeSpend: OlderRoleSpend,
});

export const NativeInspectionReport = Schema.Struct({
  suiteId: EvalId,
  version: Schema.Literal(PROJECTION_VERSION),
  source: Schema.Literal(InspectionSource.Records),
  scope: Schema.Enum(InspectionScope),
  digest: Schema.String,
  trials: Schema.Array(PriorTrial),
});

export const readArchivedStages = Effect.fn('readArchivedStages')(function* ({
  outFolder,
  caseId,
  projectGrade,
}: ReadArchivedInput): Effect.fn.Return<Option.Option<EvalInspection>, EvalFileFailed> {
  const path = join(outFolder, ApplicationFile.Manifest);
  const document = yield* onceFile({ path, schema: Schema.Json }).read();

  if (Option.isNone(document)) {
    return Option.none();
  }

  const raw = document.value;
  const isAudit = Schema.is(Audit);
  const isManifest = Schema.is(NativeManifest);
  const audit = Option.liftPredicate(isAudit)(raw);
  const recorded = Option.map(audit, (value) => value.manifest);
  const manifest = Option.orElse(recorded, () => Option.liftPredicate(isManifest)(raw));

  if (Option.isNone(manifest)) {
    return Option.none();
  }

  let scope: InspectionScope = InspectionScope.Full;

  if (Option.isSome(audit)) {
    scope = InspectionScope.JudgeOnly;
  }

  const { version, target, definition, digest } = manifest.value;

  if (jsonDigest({ value: { version, target, definition } }) !== digest) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Decode,
      path,
      reason: 'The archived manifest contents do not match its saved digest',
    });
  }

  const suiteId = yield* Schema.decodeUnknownEffect(EvalId)(definition['id']).pipe(
    Effect.mapError((error) => new EvalFileFailed({ step: EvalFileStep.Decode, path, reason: error.message })),
  );

  const projection = yield* readHistoricalReport({ outFolder });
  let records: ReadonlyArray<typeof PriorTrial.Type> = [];
  const encoded = Schema.toEncoded(NativeInspectionReport);

  if (Option.isSome(projection) && Schema.is(encoded)(projection.value)) {
    const reportPath = join(outFolder, ApplicationFile.Report);

    const report = yield* Schema.decodeUnknownEffect(NativeInspectionReport)(projection.value).pipe(
      Effect.mapError(
        (error) => new EvalFileFailed({ step: EvalFileStep.Decode, path: reportPath, reason: error.message }),
      ),
    );

    if (report.digest === digest) {
      records = report.trials;
      scope = report.scope;
    }
  }

  const readArchivedTrial = Effect.fn('readArchivedTrial')(function* (
    trial: EvalTrial,
  ): Effect.fn.Return<TrialInspection, EvalFileFailed> {
    const files = yield* readArchivedTrialFiles({ outFolder, id: trial.id });

    const prior = records.find(
      (saved) => saved.id === trial.id && saved.caseId === trial.caseId && saved.repeat === trial.repeat,
    );

    const unknown: RoleSpend = {
      isComplete: false,
      unknownAttempts: [trial.id],
      knownInputTokens: Tokens.make(0),
      knownOutputTokens: Tokens.make(0),
      knownCacheReadTokens: Tokens.make(0),
      knownCacheWriteTokens: Tokens.make(0),
      unknownUsageAttempts: [trial.id],
    };

    const projected = Option.fromUndefinedOr(prior);

    const previous = Option.getOrElse(projected, () => ({
      stages: {
        subject: StageStatus.Unknown,
        evidence: StageStatus.Unknown,
        grading: StageStatus.Unknown,
        cleanup: StageStatus.Unknown,
        isComplete: false,
        issues: [],
      },
      quality: { kind: QualityKind.Unavailable },
      subjectSpend: unknown,
      judgeSpend: unknown,
    }));

    const grade = files[ApplicationFile.Grade];
    let quality = previous.quality;

    if (Schema.is(ArchivedGrade)(grade)) {
      quality = projectGrade({ value: grade.value });
    }

    const empty = createEmptyTrialRecords();

    return {
      ...empty,
      ...trial,
      stages: previous.stages,
      quality,
      subjectSpend: previous.subjectSpend,
      judgeSpend: previous.judgeSpend,
      frozenCase: Option.none(),
      historicalRecord: Option.some(files),
    };
  });

  const trials = yield* Effect.forEach(manifest.value.trials, (trial) => readArchivedTrial(trial), { concurrency: 1 });

  const inspection: EvalInspection = {
    version: INSPECTION_VERSION,
    source: InspectionSource.HistoricalMechane,
    scope,
    isResumable: false,
    suiteId,
    digest: Option.some(digest),
    manifest: Option.none(),
    ...summarizeTrials({ trials, scope, caseId }),
    historicalDefinition: Option.some(raw),
    notices: ['Read-only native eval records. The saved files belong to the previous runtime.'],
  };

  return Option.some(inspection);
});

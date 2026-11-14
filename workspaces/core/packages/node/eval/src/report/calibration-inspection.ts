import { Array, Effect, Option, Schema } from 'effect';
import { EvalTrialId } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { CalibrationComponents } from '../judge/calibration-components.ts';
import { EvalId } from '../schemas.ts';
import { InspectionScope, StageStatus } from './inspection-schemas.ts';
import type { EvalInspection, TrialInspection } from './inspection-schemas.ts';

/** Agreement describes a comparison, independently of execution and cleanup completion. */
export const CalibrationStatus = {
  Agrees: 'agrees',
  Disagrees: 'disagrees',
  Ungraded: 'ungraded',
  Unavailable: 'unavailable',
} as const;

const COMPARED_STATUSES: ReadonlySet<string> = new Set([CalibrationStatus.Agrees, CalibrationStatus.Disagrees]);
const CalibrationMarker = Schema.Struct({ calibration: Schema.Unknown });

/** A missing grade or unsupported label cannot count as agreement or disagreement. */
export const EvalCalibration = Schema.Struct({
  selectedTrials: Schema.Int,
  inspectedTrials: Schema.Int,
  comparedTrials: Schema.Int,
  agreedTrials: Schema.Int,
  trials: Schema.Array(
    Schema.Struct({
      id: EvalTrialId,
      caseId: EvalId,
      /** None when the audit has no label for the selected trial. */
      expected: Schema.OptionFromNullOr(Schema.Json),
      /** None when no structured grade was saved. */
      observed: Schema.OptionFromNullOr(Schema.Json),
      status: Schema.Enum(CalibrationStatus),
    }),
  ),
});

export type EvalCalibration = typeof EvalCalibration.Type;
type CalibrationTrial = EvalCalibration['trials'][number];

/** The application defines label agreement; the runner owns frozen labels and missing-result accounting. */
type CompareCalibrationInput = { readonly expected: Json; readonly observed: Json };
/** None means the application cannot interpret this label or observed grade. */
export type CompareCalibration = (input: CompareCalibrationInput) => Option.Option<boolean>;
type InspectCalibrationInput = { readonly inspection: EvalInspection; readonly compareExpected: CompareCalibration };

type InspectCalibrationTrialInput = {
  readonly trial: TrialInspection;
  readonly entries: CalibrationComponents['calibration'];
  readonly compareExpected: CompareCalibration;
};

/** Reads labels from the saved audit, without loading current cases or invoking a judge. */
export const inspectCalibration = Effect.fn('inspectCalibration')(function* ({
  inspection,
  compareExpected,
}: InspectCalibrationInput): Effect.fn.Return<Option.Option<EvalCalibration>, EvalAdapterFailed> {
  if (inspection.scope !== InspectionScope.JudgeOnly || Option.isNone(inspection.manifest)) {
    return Option.none();
  }

  const supplied = inspection.manifest.value.definition.components;

  if (!Schema.is(CalibrationMarker)(supplied)) {
    return Option.none();
  }

  const components = yield* Schema.decodeUnknownEffect(CalibrationComponents, { onExcessProperty: 'error' })(
    supplied,
  ).pipe(
    Effect.mapError(
      (error) =>
        new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateCalibrationExamples, reason: error.message }),
    ),
  );

  const trials = inspection.trials.map((trial) =>
    inspectCalibrationTrial({ trial, entries: components.calibration, compareExpected }),
  );

  const compared = trials.filter((trial) => COMPARED_STATUSES.has(trial.status));

  const agreedTrials = compared.filter((trial) => trial.status === CalibrationStatus.Agrees).length;

  return Option.some({
    selectedTrials: inspection.completion.selectedTrials,
    inspectedTrials: trials.length,
    comparedTrials: compared.length,
    agreedTrials,
    trials,
  });
});

function inspectCalibrationTrial({ trial, entries, compareExpected }: InspectCalibrationTrialInput): CalibrationTrial {
  const entry = Array.findFirst(entries, (candidate) => candidate.id === trial.caseId);
  const expected = Option.map(entry, (candidate) => candidate.expected);
  const observed = Option.flatMap(trial.grade, (grade) => Option.fromUndefinedOr(grade.value));

  if (trial.stages.grading !== StageStatus.Completed || Option.isNone(observed)) {
    return { id: trial.id, caseId: trial.caseId, expected, observed, status: CalibrationStatus.Ungraded };
  }

  const evidence = trial.evidence;

  if (Option.isNone(entry) || Option.isNone(evidence) || entry.value.evidenceDigest !== evidence.value.digest) {
    return { id: trial.id, caseId: trial.caseId, expected, observed, status: CalibrationStatus.Unavailable };
  }

  const agrees = compareExpected({ expected: entry.value.expected, observed: observed.value });

  if (Option.isNone(agrees)) {
    return { id: trial.id, caseId: trial.caseId, expected, observed, status: CalibrationStatus.Unavailable };
  }

  if (agrees.value) {
    return { id: trial.id, caseId: trial.caseId, expected, observed, status: CalibrationStatus.Agrees };
  }

  return { id: trial.id, caseId: trial.caseId, expected, observed, status: CalibrationStatus.Disagrees };
}

type CalibrationLinesInput = { readonly calibration: EvalCalibration };

/** Counts only comparable judgments and keeps every inspected trial visible. */
export function calibrationLines({ calibration }: CalibrationLinesInput): ReadonlyArray<string> {
  return [
    `Calibration: ${calibration.agreedTrials}/${calibration.comparedTrials} compared judgments agree; ${calibration.inspectedTrials}/${calibration.selectedTrials} selected trials inspected`,
    ...calibration.trials.map((trial) => `${trial.caseId}: ${trial.status}`),
  ];
}

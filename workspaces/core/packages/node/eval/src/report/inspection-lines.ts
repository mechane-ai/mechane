import { Option } from 'effect';
import { inspect } from 'node:util';
import type { RoleRecord } from '../application-schemas.ts';
import { GradeChange } from './comparison-schemas.ts';
import type { EvalComparison, TrialComparison } from './comparison-schemas.ts';
import { InspectionSource, QualityKind } from './inspection-schemas.ts';
import type {
  EvalCompletion,
  EvalInspection,
  GradeQuality,
  QualitySummary,
  RoleSpend,
  TrialInspection,
} from './inspection-schemas.ts';

type InspectionLinesInput = { readonly inspection: EvalInspection };
type ComparisonLinesInput = { readonly comparison: EvalComparison };
type CompletionLineInput = { readonly label: string; readonly completion: EvalCompletion };
type QualityLinesInput = { readonly quality: QualitySummary; readonly selectedTrials: number; readonly label: string };
type SpendLineInput = { readonly role: string; readonly spend: RoleSpend };
type TrialLinesInput = { readonly trial: TrialInspection };
type RoleLinesInput = { readonly role: string; readonly record: Option.Option<RoleRecord> };
type DetailLinesInput = { readonly label: string; readonly value: unknown };
type OptionalDetailLinesInput<A> = { readonly label: string; readonly value: Option.Option<A> };
type QualityLabelInput = { readonly quality: GradeQuality };
type ComparisonTrialLineInput = { readonly trial: TrialComparison };
type ComparisonPriorityInput = { readonly trial: TrialComparison };

/** Shows completion and missing accounting before suite quality and trial evidence. */
export function inspectionLines({ inspection }: InspectionLinesInput): ReadonlyArray<string> {
  const source: string = (() => {
    if (inspection.source === InspectionSource.Records) {
      return 'saved stage records';
    }

    return 'historical report, read-only';
  })();

  return [
    `suite ${inspection.suiteId}; ${source}; scope ${inspection.scope}`,
    completionLine({ label: 'Completion', completion: inspection.completion }),
    `${inspection.completion.subjectFailedTrials} subject failures, ${inspection.completion.judgeFailedTrials} judge failures, ${inspection.completion.cancelledTrials} cancelled, ${inspection.completion.ungradableTrials} ungradable, ${inspection.completion.pendingTrials} pending`,
    `${inspection.completion.cleanupCompletedTrials}/${inspection.completion.selectedTrials} cleanup completed`,
    spendLine({ role: 'Subject', spend: inspection.subjectSpend }),
    spendLine({ role: 'Judge', spend: inspection.judgeSpend }),
    ...qualityLines({
      quality: inspection.quality,
      selectedTrials: inspection.completion.selectedTrials,
      label: 'Judge',
    }),
    ...inspection.notices.map((notice) => `Notice: ${notice}`),
    ...inspection.trials.flatMap((trial) => trialLines({ trial })),
  ];
}

/** Lists experiment changes and individual regressions before aggregate grade summaries. */
export function comparisonLines({ comparison }: ComparisonLinesInput): ReadonlyArray<string> {
  const completion = [
    completionLine({ label: 'Baseline completion', completion: comparison.baselineCompletion }),
    completionLine({ label: 'Candidate completion', completion: comparison.candidateCompletion }),
  ];

  const differences = comparison.experimentDifferences.flatMap((difference) => [
    `Experiment difference: ${difference.field}`,
    `  baseline: ${difference.baseline}`,
    `  candidate: ${difference.candidate}`,
  ]);

  const exclusions = `Declared subject component keys: ${comparison.subjectComponentKeys.join(', ')}`;

  if (!comparison.isComparable) {
    return [
      ...completion,
      'Incomparable runs',
      ...comparison.incompatibilities.map((issue) => `  ${issue}`),
      exclusions,
      ...differences,
      ...comparison.notices,
    ];
  }

  const trials = comparison.trials.toSorted(
    (left, right) => comparisonPriority({ trial: left }) - comparisonPriority({ trial: right }),
  );

  return [
    ...completion,
    'Comparable frozen cases, judge, fixture, evidence, and grading rules',
    exclusions,
    ...differences,
    ...trials.map((trial) => comparisonTrialLine({ trial })),
    ...qualityLines({
      quality: comparison.baselineQuality,
      selectedTrials: comparison.baselineCompletion.selectedTrials,
      label: 'Baseline judge',
    }),
    ...qualityLines({
      quality: comparison.candidateQuality,
      selectedTrials: comparison.candidateCompletion.selectedTrials,
      label: 'Candidate judge',
    }),
    ...comparison.notices,
  ];
}

function completionLine({ label, completion }: CompletionLineInput): string {
  const state: string = (() => {
    if (completion.isComplete) {
      return 'complete';
    }

    return 'incomplete';
  })();

  return `${label}: ${state}; ${completion.completedTrials}/${completion.selectedTrials} trials completed, ${completion.gradedTrials}/${completion.selectedTrials} graded`;
}

function qualityLines({ quality, selectedTrials, label }: QualityLinesInput): ReadonlyArray<string> {
  const numeric = quality.numeric.map((summary) => {
    const mean = Option.match(summary.meanScore, { onNone: () => 'unavailable', onSome: String });

    return `${label} score (${summary.scaleId}): mean ${mean}; ${summary.gradedTrials}/${selectedTrials} graded, score sum ${summary.scoreSum}/${summary.gradedTrials}`;
  });

  const criteria: ReadonlyArray<string> = (() => {
    if (quality.criteria.gradedTrials === 0) {
      return [];
    }

    const { gradedTrials, pass, fail, uncertain } = quality.criteria;

    return [
      `${label} criterion verdicts: ${gradedTrials}/${selectedTrials} graded; ${pass} pass, ${fail} fail, ${uncertain} uncertain`,
    ];
  })();

  const opaque: ReadonlyArray<string> = (() => {
    if (quality.unprojectedTrials === 0) {
      return [];
    }

    return [`${label} structured grades: ${quality.unprojectedTrials}/${selectedTrials}; no suite score projection`];
  })();

  if (numeric.length === 0 && criteria.length === 0 && opaque.length === 0) {
    return [`${label} quality: unavailable; 0/${selectedTrials} graded`];
  }

  return [...numeric, ...criteria, ...opaque];
}

function spendLine({ role, spend }: SpendLineInput): string {
  const accounting: string = (() => {
    if (spend.isComplete) {
      return 'complete charge accounting';
    }

    return `partial charge accounting; unknown attempts: ${spend.unknownAttempts.join(', ')}`;
  })();

  const usage: string = (() => {
    if (spend.unknownUsageAttempts.length === 0) {
      return 'complete reported usage';
    }

    return `partial usage; unknown attempts: ${spend.unknownUsageAttempts.join(', ')}`;
  })();

  return `${role}: ${spend.knownChargedMicros} known charged micro-dollars (${accounting}); ${spend.knownInputTokens} input, ${spend.knownOutputTokens} output, ${spend.knownCacheReadTokens} cache-read, ${spend.knownCacheWriteTokens} cache-write tokens (${usage})`;
}

function trialLines({ trial }: TrialLinesInput): ReadonlyArray<string> {
  return [
    `${trial.caseId} #${trial.repeat} (trial ${trial.id})`,
    `  subject ${trial.stages.subject}; evidence ${trial.stages.evidence}; grading ${trial.stages.grading}; cleanup ${trial.stages.cleanup}`,
    ...trial.stages.issues.map((issue) => `  Issue: ${issue}`),
    ...detailLines({ label: 'Saved failure history', value: trial.failures }),
    `  Judge quality: ${qualityLabel({ quality: trial.quality })}`,
    ...optionalDetailLines({ label: 'Frozen case', value: trial.frozenCase }),
    ...optionalDetailLines({ label: 'Evidence and validation', value: trial.evidence }),
    ...optionalDetailLines({ label: 'Structured grade and evidence references', value: trial.grade }),
    ...detailLines({ label: 'Recorded tool calls', value: trial.observations }),
    ...roleLines({ role: 'Subject', record: trial.subject }),
    ...roleLines({ role: 'Judge', record: trial.judge }),
    `  ${spendLine({ role: 'Subject', spend: trial.subjectSpend })}`,
    `  ${spendLine({ role: 'Judge', spend: trial.judgeSpend })}`,
    ...detailLines({ label: 'Cleanup attempts', value: trial.cleanup }),
    ...optionalDetailLines({ label: 'Historical trial record', value: trial.historicalRecord }),
  ];
}

function roleLines({ role, record }: RoleLinesInput): ReadonlyArray<string> {
  if (Option.isNone(record)) {
    return [`  ${role} result: unavailable`];
  }

  return detailLines({ label: `${role} result, model identities, usage, and public output`, value: record.value });
}

function detailLines({ label, value }: DetailLinesInput): ReadonlyArray<string> {
  const text = inspect(value, { depth: null, colors: false, maxArrayLength: null, maxStringLength: null });

  return [`  ${label}:`, ...text.split('\n').map((line) => `    ${line}`)];
}

function optionalDetailLines<A>({ label, value }: OptionalDetailLinesInput<A>): ReadonlyArray<string> {
  return Option.match(value, {
    onNone: () => [`  ${label}: unavailable`],
    onSome: (saved) => detailLines({ label, value: saved }),
  });
}

function qualityLabel({ quality }: QualityLabelInput): string {
  switch (quality.kind) {
    case QualityKind.Numeric:
      return `${quality.score} (${quality.scaleId})`;
    case QualityKind.Criteria:
      return `${quality.verdict} (criterion verdict)`;
    case QualityKind.Structured:
      return 'structured grade; no suite score projection';
    case QualityKind.Unavailable:
      return 'unavailable';
  }
}

function comparisonTrialLine({ trial }: ComparisonTrialLineInput): string {
  const delta = Option.match(trial.grade.scoreDelta, {
    onNone: () => '',
    onSome: (scoreDelta) => `, score delta ${scoreDelta}`,
  });

  const issues = trial.grade.issues.join('; ');

  return `${trial.caseId} #${trial.repeat}: ${trial.grade.change}${delta}; ${qualityLabel({ quality: trial.baselineQuality })} → ${qualityLabel({ quality: trial.candidateQuality })}; observed tool errors ${trial.baselineToolErrors} → ${trial.candidateToolErrors}; ${issues}`;
}

const REGRESSION_PRIORITY = 0;
const INCOMPLETE_PRIORITY = 1;
const TOOL_ERROR_PRIORITY = 2;
const OTHER_CHANGE_PRIORITY = 3;

function comparisonPriority({ trial }: ComparisonPriorityInput): number {
  if (trial.grade.change === GradeChange.Regressed) {
    return REGRESSION_PRIORITY;
  }

  if (!trial.isCandidateComplete) {
    return INCOMPLETE_PRIORITY;
  }

  if (trial.candidateToolErrors > trial.baselineToolErrors) {
    return TOOL_ERROR_PRIORITY;
  }

  return OTHER_CHANGE_PRIORITY;
}

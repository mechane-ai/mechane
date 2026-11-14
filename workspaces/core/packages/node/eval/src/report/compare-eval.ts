import { Option, Record, Schema } from 'effect';
import { inspect, isDeepStrictEqual } from 'node:util';
import type { EvalManifest } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import { CriterionVerdict } from '../constants.ts';
import type { EvalId, Grade } from '../schemas.ts';
import { COMPARISON_VERSION, GradeChange } from './comparison-schemas.ts';
import type { EvalComparison, ExperimentDifference, GradeDifference, TrialComparison } from './comparison-schemas.ts';
import { InspectionSource, QualityKind } from './inspection-schemas.ts';
import type { CriteriaQuality, EvalInspection, GradeQuality, TrialInspection } from './inspection-schemas.ts';

export type CompareGradesInput = { readonly baseline: TrialInspection; readonly candidate: TrialInspection };

/** Compares the suite's grades without assigning numeric credit to uncertain verdicts. */
export type CompareGrades = (input: CompareGradesInput) => GradeDifference;

/** Keeps subject variation explicit while requiring matching measurement semantics. */
export type ComparisonOptions = {
  readonly subjectComponentKeys: ReadonlyArray<string>;
  readonly compareGrades: CompareGrades;
};

type CompareEvalInput = ComparisonOptions & { readonly baseline: EvalInspection; readonly candidate: EvalInspection };

/** Uses the default grade comparison and treats every component change as a semantic change. */
export const DEFAULT_COMPARISON_OPTIONS: Readonly<ComparisonOptions> = {
  subjectComponentKeys: [],
  compareGrades: compareTrialGrades,
};

type CompareCompatibilityInput = {
  readonly baseline: EvalInspection;
  readonly candidate: EvalInspection;
  readonly subjectComponentKeys: ReadonlyArray<string>;
};

type ManifestCompatibilityInput = {
  readonly baseline: EvalManifest;
  readonly candidate: EvalManifest;
  readonly subjectComponentKeys: ReadonlyArray<string>;
};

type CompareFieldInput = { readonly field: string; readonly baseline: unknown; readonly candidate: unknown };
type CompareTrialInput = CompareGradesInput & { readonly compareGrades: CompareGrades };
type ComponentEntriesInput = { readonly components: Json };
type TrialComparisonKeyInput = { readonly caseId: EvalId; readonly repeat: number };
type CompareQualityInput = { readonly baseline: GradeQuality; readonly candidate: GradeQuality };
type CriterionChangeInput = { readonly baseline: CriterionVerdict; readonly candidate: CriterionVerdict };
type CompareCriteriaInput = { readonly baseline: CriteriaQuality; readonly candidate: CriteriaQuality };

type CompareCriterionInput = {
  readonly baseline: Grade['criteria'][number];
  readonly candidate: Grade['criteria'][number];
};

type CriterionDifference = { readonly id: EvalId; readonly change: GradeChange; readonly issue: string };

const STRICT_COMPONENT_KEYS: ReadonlySet<string> = new Set([
  'adapterSHA256',
  'fixtureSemantics',
  'evidenceSemantics',
  'gradeSemantics',
  'evidenceJsonSchema',
  'judgeInstructionsSHA256',
]);

/** Compares frozen cases and grading rules before deriving any quality differences. */
export function compareEval({
  baseline,
  candidate,
  subjectComponentKeys,
  compareGrades,
}: CompareEvalInput): EvalComparison {
  const compatibility = compareCompatibility({ baseline, candidate, subjectComponentKeys });
  const candidateEntries = candidate.trials.map((trial) => [trialComparisonKey(trial), trial] as const);
  const candidates = new Map(candidateEntries);

  const pairs = baseline.trials.flatMap((trial) => {
    const key = trialComparisonKey(trial);
    const candidateRecord = candidates.get(key);
    const candidateTrial = Option.fromUndefinedOr(candidateRecord);

    if (Option.isNone(candidateTrial)) {
      return [];
    }

    return [{ baseline: trial, candidate: candidateTrial.value }];
  });

  const isComparable = compatibility.incompatibilities.length === 0;

  const trials: ReadonlyArray<TrialComparison> = (() => {
    if (!isComparable) {
      return [];
    }

    return pairs.map((pair) => compareTrial({ ...pair, compareGrades }));
  })();

  return {
    version: COMPARISON_VERSION,
    isComparable,
    isComplete: baseline.completion.isComplete && candidate.completion.isComplete,
    hasRegression: trials.some((trial) => trial.grade.change === GradeChange.Regressed),
    subjectComponentKeys,
    incompatibilities: compatibility.incompatibilities,
    experimentDifferences: compatibility.experimentDifferences,
    baselineCompletion: baseline.completion,
    candidateCompletion: candidate.completion,
    trials,
    baselineQuality: baseline.quality,
    candidateQuality: candidate.quality,
    notices: compatibility.notices,
  };
}

type Compatibility = {
  readonly incompatibilities: ReadonlyArray<string>;
  readonly experimentDifferences: ReadonlyArray<ExperimentDifference>;
  readonly notices: ReadonlyArray<string>;
};

function compareCompatibility({ baseline, candidate, subjectComponentKeys }: CompareCompatibilityInput): Compatibility {
  if (baseline.source !== InspectionSource.Records || candidate.source !== InspectionSource.Records) {
    return {
      incompatibilities: ['Historical reports do not establish matching fixture, evidence, and grading semantics.'],
      experimentDifferences: [],
      notices: ['Historical reports remain readable evidence and cannot establish a measured improvement.'],
    };
  }

  if (Option.isNone(baseline.manifest) || Option.isNone(candidate.manifest)) {
    return {
      incompatibilities: ['A comparison requires both frozen manifests.'],
      experimentDifferences: [],
      notices: [],
    };
  }

  const compatibility = manifestCompatibility({
    baseline: baseline.manifest.value,
    candidate: candidate.manifest.value,
    subjectComponentKeys,
  });

  const baselineTrials = baseline.trials.map((trial) => trialComparisonKey(trial)).toSorted();
  const candidateTrials = candidate.trials.map((trial) => trialComparisonKey(trial)).toSorted();

  const trialDifferences = compareField({
    field: 'inspected trial selection',
    baseline: baselineTrials,
    candidate: candidateTrials,
  });

  const scopeDifferences = compareField({
    field: 'inspection scope',
    baseline: baseline.scope,
    candidate: candidate.scope,
  });

  return {
    ...compatibility,
    incompatibilities: [
      ...compatibility.incompatibilities,
      ...trialDifferences.map((difference) => difference.field),
      ...scopeDifferences.map((difference) => difference.field),
    ],
  };
}

function manifestCompatibility({
  baseline,
  candidate,
  subjectComponentKeys,
}: ManifestCompatibilityInput): Compatibility {
  const baselineDefinition = baseline.definition;
  const candidateDefinition = candidate.definition;
  const { isSelfGrading: baselineIsSelfGrading, ...baselineJudge } = baselineDefinition.judge;
  const { isSelfGrading: candidateIsSelfGrading, ...candidateJudge } = candidateDefinition.judge;
  const baselineComponents = componentEntries({ components: baselineDefinition.components });
  const candidateComponents = componentEntries({ components: candidateDefinition.components });
  const baselineKeys = [...baselineComponents.keys()];
  const candidateKeys = [...candidateComponents.keys()];
  const allKeys = [...baselineKeys, ...candidateKeys];
  const componentKeySet = new Set(allKeys);
  const componentKeys = [...componentKeySet].toSorted();

  const componentDifferences = componentKeys.flatMap((field) => {
    const baselineValue = baselineComponents.get(field);
    const candidateValue = candidateComponents.get(field);

    return compareField({ field, baseline: baselineValue, candidate: candidateValue });
  });

  const strictComponents = componentDifferences.filter(
    (difference) => STRICT_COMPONENT_KEYS.has(difference.field) || !subjectComponentKeys.includes(difference.field),
  );

  const variableComponents = componentDifferences.filter(
    (difference) => !STRICT_COMPONENT_KEYS.has(difference.field) && subjectComponentKeys.includes(difference.field),
  );

  const strictFields = [
    {
      field: 'suite identity',
      baseline: [baselineDefinition.id, baselineDefinition.version],
      candidate: [candidateDefinition.id, candidateDefinition.version],
    },
    {
      field: 'adapter and fixture fingerprint',
      baseline: baselineDefinition.adapter,
      candidate: candidateDefinition.adapter,
    },
    {
      field: 'cases, frozen inputs, and rubrics',
      baseline: baselineDefinition.cases,
      candidate: candidateDefinition.cases,
    },
    { field: 'repeats', baseline: baselineDefinition.repeats, candidate: candidateDefinition.repeats },
    { field: 'judge configuration and grade schema', baseline: baselineJudge, candidate: candidateJudge },
    { field: 'tool definitions', baseline: baselineDefinition.tools, candidate: candidateDefinition.tools },
    {
      field: 'MCP connection name',
      baseline: baselineDefinition.connectionName,
      candidate: candidateDefinition.connectionName,
    },
  ];

  const strictDifferences = strictFields.flatMap((field) => compareField(field));

  const variableFields = [
    { field: 'subject settings', baseline: baselineDefinition.subject, candidate: candidateDefinition.subject },
    { field: 'self-grading relationship', baseline: baselineIsSelfGrading, candidate: candidateIsSelfGrading },
    { field: 'target and assessed build', baseline: baseline.target, candidate: candidate.target },
    { field: 'execution bounds', baseline: baselineDefinition.bounds, candidate: candidateDefinition.bounds },
  ];

  const variableDifferences = variableFields.flatMap((field) => compareField(field));

  return {
    incompatibilities: [
      ...strictDifferences.map((difference) => difference.field),
      ...strictComponents.map((difference) => `component ${difference.field}`),
    ],
    experimentDifferences: [
      ...variableDifferences,
      ...variableComponents.map((difference) => ({ ...difference, field: `component ${difference.field}` })),
    ],
    notices: ['Grades are judge judgments. Repeat differences describe observed variation.'],
  };
}

function compareField({ field, baseline, candidate }: CompareFieldInput): ReadonlyArray<ExperimentDifference> {
  if (isDeepStrictEqual(baseline, candidate)) {
    return [];
  }

  return [
    {
      field,
      baseline: inspect(baseline, { depth: null, sorted: true }),
      candidate: inspect(candidate, { depth: null, sorted: true }),
    },
  ];
}

function componentEntries({ components }: ComponentEntriesInput): ReadonlyMap<string, Json> {
  const JsonRecord = Schema.Record(Schema.String, Schema.Json);
  const isJsonRecord = Schema.is(JsonRecord);

  if (isJsonRecord(components)) {
    const entries = Record.toEntries<string, Json>(components);

    return new Map(entries);
  }

  return new Map([['components', components]]);
}

function compareTrial({ baseline, candidate, compareGrades }: CompareTrialInput): TrialComparison {
  return {
    caseId: baseline.caseId,
    repeat: baseline.repeat,
    baselineTrialId: baseline.id,
    candidateTrialId: candidate.id,
    isBaselineComplete: baseline.stages.isComplete,
    isCandidateComplete: candidate.stages.isComplete,
    baselineQuality: baseline.quality,
    candidateQuality: candidate.quality,
    baselineToolErrors: baseline.observations.filter((observation) => observation.result.isError).length,
    candidateToolErrors: candidate.observations.filter((observation) => observation.result.isError).length,
    grade: compareGrades({ baseline, candidate }),
  };
}

function compareTrialGrades({ baseline, candidate }: CompareGradesInput): GradeDifference {
  return compareQuality({ baseline: baseline.quality, candidate: candidate.quality });
}

function compareQuality({ baseline, candidate }: CompareQualityInput): GradeDifference {
  if (baseline.kind === QualityKind.Numeric && candidate.kind === QualityKind.Numeric) {
    if (baseline.scaleId !== candidate.scaleId) {
      return { change: GradeChange.Unavailable, scoreDelta: Option.none(), issues: ['Numeric grade scales differ.'] };
    }

    const scoreDelta = candidate.score - baseline.score;

    const change: GradeChange = (() => {
      if (scoreDelta < 0) {
        return GradeChange.Regressed;
      }

      if (scoreDelta > 0) {
        return GradeChange.Improved;
      }

      return GradeChange.Unchanged;
    })();

    return { change, scoreDelta: Option.some(scoreDelta), issues: [] };
  }

  if (baseline.kind === QualityKind.Criteria && candidate.kind === QualityKind.Criteria) {
    return compareCriteria({ baseline, candidate });
  }

  if (baseline.kind === QualityKind.Unavailable || candidate.kind === QualityKind.Unavailable) {
    return { change: GradeChange.Unavailable, scoreDelta: Option.none(), issues: ['A complete grade is unavailable.'] };
  }

  return {
    change: GradeChange.Unavailable,
    scoreDelta: Option.none(),
    issues: ['The suite has no matching grade comparison.'],
  };
}

function compareCriteria({ baseline, candidate }: CompareCriteriaInput): GradeDifference {
  if (Option.isNone(baseline.criteria) || Option.isNone(candidate.criteria)) {
    const change = criterionChange({ baseline: baseline.verdict, candidate: candidate.verdict });

    return { change, scoreDelta: Option.none(), issues: [] };
  }

  const baselineIds = baseline.criteria.value.map((criterion) => criterion.id).toSorted();
  const candidateIds = candidate.criteria.value.map((criterion) => criterion.id).toSorted();

  if (!isDeepStrictEqual(baselineIds, candidateIds)) {
    return {
      change: GradeChange.Unavailable,
      scoreDelta: Option.none(),
      issues: ['The grades do not assess the same criteria.'],
    };
  }

  const entries = baseline.criteria.value.map((criterion) => [criterion.id, criterion] as const);
  const before = new Map(entries);

  const differences = candidate.criteria.value.flatMap((criterion) => {
    const previous = before.get(criterion.id);
    const saved = Option.fromUndefinedOr(previous);

    return Option.match(saved, {
      onNone: () => [],
      onSome: (original) => [compareCriterion({ baseline: original, candidate: criterion })],
    });
  });

  const changedGrades = differences.map((difference) => difference.change);
  const changes = new Set(changedGrades);

  const change: GradeChange = (() => {
    if (changes.has(GradeChange.Regressed)) {
      return GradeChange.Regressed;
    }

    if (changes.has(GradeChange.Changed)) {
      return GradeChange.Changed;
    }

    if (changes.has(GradeChange.Improved)) {
      return GradeChange.Improved;
    }

    return GradeChange.Unchanged;
  })();

  return {
    change,
    scoreDelta: Option.none(),
    issues: differences
      .filter((difference) => difference.change !== GradeChange.Unchanged)
      .map((difference) => difference.issue),
  };
}

function compareCriterion({ baseline, candidate }: CompareCriterionInput): CriterionDifference {
  return {
    id: baseline.id,
    change: criterionChange({ baseline: baseline.verdict, candidate: candidate.verdict }),
    issue: `criterion ${baseline.id}: ${baseline.verdict} → ${candidate.verdict}`,
  };
}

function criterionChange({ baseline, candidate }: CriterionChangeInput): GradeChange {
  if (baseline === candidate) {
    return GradeChange.Unchanged;
  }

  if (baseline === CriterionVerdict.Pass && candidate === CriterionVerdict.Fail) {
    return GradeChange.Regressed;
  }

  if (baseline === CriterionVerdict.Fail && candidate === CriterionVerdict.Pass) {
    return GradeChange.Improved;
  }

  return GradeChange.Changed;
}

function trialComparisonKey({ caseId, repeat }: TrialComparisonKeyInput): string {
  return `${caseId}#${repeat}`;
}

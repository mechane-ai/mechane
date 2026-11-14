import { Number, Option, Schema } from 'effect';
import type { Json } from '../application-types.ts';
import { CriterionVerdict } from '../constants.ts';
import { Grade } from '../schemas.ts';
import { QualityKind } from './inspection-schemas.ts';
import type {
  CriteriaQuality,
  GradeQuality,
  NumericQuality,
  NumericSummary,
  QualitySummary,
} from './inspection-schemas.ts';

export type ProjectGradeInput = { readonly value: Json };

/** Preserves the suite's score semantics instead of assuming every structured grade is numeric. */
export type ProjectGrade = (input: ProjectGradeInput) => GradeQuality;

type CriterionGradeQualityInput = { readonly grade: Grade };
type SummarizeQualityInput = { readonly qualities: ReadonlyArray<GradeQuality> };

type SummarizeNumericQualityInput = {
  readonly qualities: ReadonlyArray<GradeQuality>;
  readonly scaleId: NumericQuality['scaleId'];
};

export function projectGrade({ value }: ProjectGradeInput): GradeQuality {
  if (Schema.is(Grade)(value)) {
    return criterionGradeQuality({ grade: value });
  }

  return { kind: QualityKind.Structured };
}

function criterionGradeQuality({ grade }: CriterionGradeQualityInput): CriteriaQuality {
  const criterionVerdicts = grade.criteria.map((criterion) => criterion.verdict);
  const verdicts = new Set(criterionVerdicts);

  const verdict: CriterionVerdict = (() => {
    if (verdicts.has(CriterionVerdict.Fail)) {
      return CriterionVerdict.Fail;
    }

    if (verdicts.has(CriterionVerdict.Uncertain)) {
      return CriterionVerdict.Uncertain;
    }

    return CriterionVerdict.Pass;
  })();

  return { kind: QualityKind.Criteria, verdict, criteria: Option.some(grade.criteria) };
}

export function summarizeQuality({ qualities }: SummarizeQualityInput): QualitySummary {
  const numericScales = qualities.flatMap((quality) => {
    if (quality.kind === QualityKind.Numeric) {
      return [quality.scaleId];
    }

    return [];
  });

  const scales = new Set(numericScales);

  const criteria = qualities.filter((quality) => quality.kind === QualityKind.Criteria);

  return {
    numeric: [...scales].map((scaleId) => summarizeNumericQuality({ qualities, scaleId })),
    criteria: {
      gradedTrials: criteria.length,
      pass: criteria.filter((quality) => quality.verdict === CriterionVerdict.Pass).length,
      fail: criteria.filter((quality) => quality.verdict === CriterionVerdict.Fail).length,
      uncertain: criteria.filter((quality) => quality.verdict === CriterionVerdict.Uncertain).length,
    },
    unprojectedTrials: qualities.filter((quality) => quality.kind === QualityKind.Structured).length,
  };
}

function summarizeNumericQuality({ qualities, scaleId }: SummarizeNumericQualityInput): NumericSummary {
  const scores = qualities.flatMap((quality) => {
    if (quality.kind === QualityKind.Numeric && quality.scaleId === scaleId) {
      return [quality.score];
    }

    return [];
  });

  const scoreSum = Number.sumAll(scores);

  const meanScore: Option.Option<number> = (() => {
    if (scores.length === 0) {
      return Option.none();
    }

    return Option.some(scoreSum / scores.length);
  })();

  return { scaleId, gradedTrials: scores.length, scoreSum, meanScore };
}

import type { ReactNode } from 'react';
import { DotPlot } from '../../../charts/src/comparison/index.ts';
import type { DotPlotSeries } from '../../../charts/src/comparison/index.ts';
import type { FigureProps, FigureSelectionProps, PlotAxis, PlotHeight } from '../../../charts/src/index.ts';
// Deep import: the shared figure frame is not exported from the charts index yet.
import { FigureInvalid } from '../../../charts/src/plot/index.ts';
import { isScoreInterval, repeatedId } from './evaluation-data.ts';
import type { EvaluationModel, ScoreValue } from './evaluation-data.ts';

/** One model's scores on the benchmark's categories, by category id. A category left out reads as not measured. */
export type ModelScores = {
  /** The id of a model in `models`. */
  readonly model: string;
  readonly values: Readonly<Record<string, ScoreValue>>;
};

export type ScoreBreakdownProps = FigureProps &
  FigureSelectionProps & {
    /**
     * Every model the page names, for their labels and pinned hues. Only models with scores are drawn. Under a
     * `ToneScope` each model keeps the hue it has elsewhere on the page.
     */
    readonly models: ReadonlyArray<EvaluationModel>;
    /** The categories or tasks of the benchmark, listed down the side in the order given. */
    readonly categories: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    /** The models drawn, in legend order. */
    readonly scores: ReadonlyArray<ModelScores>;
    /** The measured axis. Position carries the score, so it need not start at zero. */
    readonly value: PlotAxis;
    readonly height?: PlotHeight | undefined;
  };

function breakdownProblem({ models, scores }: Pick<ScoreBreakdownProps, 'models' | 'scores'>): string | undefined {
  const known = new Set(models.map((model) => model.id));
  const repeated = repeatedId(scores.map((entry) => entry.model));

  if (repeated !== undefined) {
    return `The model ${repeated} has two sets of scores.`;
  }

  const unknown = scores.find((entry) => !known.has(entry.model));

  if (unknown !== undefined) {
    return `Scores name the model ${unknown.model}, which is not listed.`;
  }

  const unbracketed = scores.find((entry) =>
    Object.values(entry.values).some(
      (score) => isScoreInterval(score) && (score.low > score.value || score.high < score.value),
    ),
  );

  return unbracketed === undefined
    ? undefined
    : `A score of ${unbracketed.model} lies outside its interval. The low bound comes first.`;
}

/**
 * One benchmark broken down by category, with a dot per model on each row and an optional interval behind it, for
 * showing under a leaderboard where models differ. Inside a `ChartLink`, pointing the link at a model, such as by
 * resting on its leaderboard row, keeps that model at full strength and fades the others. The one model then reads
 * across every category.
 */
export function ScoreBreakdown(props: ScoreBreakdownProps): ReactNode {
  const { models, categories, scores, value, height, ...figure } = props;
  const problem = figure.status === 'loading' ? undefined : breakdownProblem({ models, scores });

  if (problem !== undefined) {
    return <FigureInvalid {...figure} message={problem} />;
  }

  const modelsById = new Map(models.map((model) => [model.id, model]));

  const series: ReadonlyArray<DotPlotSeries> = scores.map((entry) => {
    const model = modelsById.get(entry.model);
    const scored = Object.entries(entry.values);

    return {
      id: entry.model,
      label: model?.label ?? entry.model,
      tone: model?.tone,
      values: Object.fromEntries(scored.map(([id, score]) => [id, isScoreInterval(score) ? score.value : score])),
      intervals: Object.fromEntries(
        scored.flatMap(([id, score]) =>
          isScoreInterval(score) ? [[id, { lower: score.low, upper: score.high }]] : [],
        ),
      ),
    };
  });

  return <DotPlot {...figure} rows={categories} series={series} value={value} height={height} />;
}

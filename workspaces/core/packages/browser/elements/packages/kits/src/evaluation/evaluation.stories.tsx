import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartLink, ToneScope } from '../../../charts/src/index.ts';
import type { DataTableSort } from '../../../collections/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { EvaluationModel } from './evaluation-data.ts';
import type { LeaderboardColumn } from './leaderboard-cells.tsx';
import { Leaderboard } from './leaderboard.tsx';
import type { LeaderboardRow } from './leaderboard.tsx';
import { ModelComparison } from './model-comparison.tsx';
import type { ComparisonRow } from './model-comparison.tsx';
import { ScoreBreakdown } from './score-breakdown.tsx';
import type { ModelScores } from './score-breakdown.tsx';

const meta = {
  title: 'Kits/Evaluation',
  component: Leaderboard,
  subcomponents: { ModelComparison, ScoreBreakdown },
  parameters: {
    docs: {
      description: {
        component:
          'Components that show model evaluation results the way papers and eval dashboards do. Leaderboard ranks models over benchmarks with table cell graphics and marks the best value of each column in bold; ScoreBreakdown splits one benchmark by category; ModelComparison sets two models head to head with the differences and the test written in words. Put them under one ToneScope and ChartLink so a model keeps its hue everywhere and resting on its leaderboard row marks it in the breakdown. The application supplies every score, interval, difference and test. All models and numbers here are synthetic and closed-form.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const LOCALE = 'en-US';
const CHECKPOINTS = 8;

const styles = stylex.create({
  page: { display: 'grid', gap: spacing.xxl, maxWidth: 1080, minWidth: 0, color: colors.ink },
  heading: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
  },
  states: { display: 'grid', gap: spacing.xxl, maxWidth: 960, minWidth: 0 },
});

/** Each synthetic model has one skill that sets all its scores, plus a small closed-form wobble per benchmark. */
const roster = [
  { id: 'atlas-70b', label: 'Atlas 70B', detail: 'Checkpoint 2026-10', skill: 0.84 },
  { id: 'cirrus-34b', label: 'Cirrus 34B', detail: 'Checkpoint 2026-09', skill: 0.79 },
  { id: 'eos-22b', label: 'Eos 22B', detail: 'Preview', skill: 0.74 },
  { id: 'atlas-13b', label: 'Atlas 13B', detail: 'Checkpoint 2026-10', skill: 0.71 },
  { id: 'borealis-8b', label: 'Borealis 8B', detail: 'Checkpoint 2026-08', skill: 0.63 },
  { id: 'draco-3b', label: 'Draco 3B', detail: 'Checkpoint 2026-07', skill: 0.5 },
] as const;

const models: ReadonlyArray<EvaluationModel> = roster.map(({ id, label, detail }) => ({ id, label, detail }));

function wobble(model: number, task: number): number {
  return 0.03 * Math.sin(model * 2.3 + task * 1.7);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const percent = { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 } as const;

const points = {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  signDisplay: 'exceptZero',
} as const;

const columns: ReadonlyArray<LeaderboardColumn> = [
  {
    id: 'reasoning',
    label: 'Reasoning, 95% interval',
    kind: 'interval',
    format: percent,
    domain: [0.4, 0.9],
    isHigherBetter: true,
  },
  { id: 'coding', label: 'Coding pass@1', kind: 'score', format: percent, domain: [0, 1], isHigherBetter: true },
  { id: 'change', label: 'Change', kind: 'change', format: points, isHigherBetter: true, width: 136 },
  {
    id: 'history',
    label: 'Reasoning trend',
    kind: 'trend',
    format: percent,
    domain: [0.2, 0.9],
    isHigherBetter: true,
    isSecondary: true,
  },
  {
    id: 'calibration',
    label: 'Calibration error',
    kind: 'heat',
    format: percent,
    domain: [0, 0.2],
    isHigherBetter: false,
    width: 168,
    isSecondary: true,
  },
];

const allRows: ReadonlyArray<LeaderboardRow> = roster.map(({ id, skill }, index) => {
  const reasoning = round(skill + wobble(index, 0));
  const margin = round(0.02 + 0.1 * (1 - skill));
  const isPreview = id === 'eos-22b';

  return {
    model: id,
    rank: index + 1,
    values: {
      reasoning: { value: reasoning, low: round(reasoning - margin), high: round(reasoning + margin) },
      coding: round(skill - 0.12 + wobble(index, 1)),
      change: isPreview ? null : round(0.02 * Math.cos(index * 1.9)),
      history: Array.from({ length: CHECKPOINTS }, (_, step) =>
        isPreview && step < 5 ? null : round(reasoning - 0.2 * Math.exp(-step / 2.5)),
      ),
      calibration: isPreview ? null : round(0.03 + 0.18 * (1 - skill) + wobble(index, 2) / 3),
    },
  };
});

/**
 * The rows with only the values of the listed columns, since a leaderboard refuses values for columns it does not show.
 * The ranks are left out, so the narrower table fits beside its checkboxes.
 */
function rowsFor(shown: ReadonlyArray<LeaderboardColumn>): ReadonlyArray<LeaderboardRow> {
  const ids = new Set(shown.map((column) => column.id));

  return allRows.map((row) => ({
    model: row.model,
    values: Object.fromEntries(Object.entries(row.values).filter(([id]) => ids.has(id))),
  }));
}

const reportColumnIds: ReadonlySet<string> = new Set(['reasoning', 'coding']);
const reportColumns = columns.filter((column) => reportColumnIds.has(column.id));

const categories = [
  { id: 'math', label: 'Mathematics' },
  { id: 'logic', label: 'Formal logic' },
  { id: 'science', label: 'Natural science' },
  { id: 'law', label: 'Law' },
  { id: 'history', label: 'History' },
  { id: 'reading', label: 'Reading' },
] as const;

const categoryOffsets = [-0.09, -0.05, 0.02, -0.12, 0.04, 0.07] as const;

function breakdown(ids: ReadonlyArray<string>): ReadonlyArray<ModelScores> {
  return roster.flatMap(({ id, skill }, model) =>
    ids.includes(id)
      ? [
          {
            model: id,
            values: Object.fromEntries(
              categories.map((category, task) => {
                const value = round(skill + (categoryOffsets[task] ?? 0) + wobble(model, task + 3));

                return [category.id, { value, low: round(value - 0.035), high: round(value + 0.035) }];
              }),
            ),
          },
        ]
      : [],
  );
}

const benchmarks = [
  { id: 'reasoning', label: 'Reasoning', task: 0, offset: 0, margin: 0.018, note: undefined },
  { id: 'coding', label: 'Coding', task: 1, offset: -0.12, margin: 0.03, note: undefined },
  { id: 'math', label: 'Competition math', task: 9, offset: -0.2, margin: 0.05, note: 'Fewer than 300 problems' },
  { id: 'context', label: 'Long context', task: 10, offset: -0.06, margin: 0.04, note: undefined },
  {
    id: 'tools',
    label: 'Tool use',
    task: 11,
    offset: -0.1,
    margin: 0.06,
    note: 'Agent harness changed in this release',
  },
  { id: 'translation', label: 'Translation', task: 12, offset: 0.05, margin: 0.02, note: undefined },
] as const;

function skillOf(index: number): number {
  return roster[index]?.skill ?? 0;
}

function headToHead(reference: string, candidate: string): ReadonlyArray<ComparisonRow> {
  const first = roster.findIndex((model) => model.id === reference);
  const second = roster.findIndex((model) => model.id === candidate);

  return benchmarks.map((benchmark) => {
    const scoreA = round(skillOf(first) + benchmark.offset + wobble(first, benchmark.task));
    const scoreB = round(skillOf(second) + benchmark.offset + wobble(second, benchmark.task));
    const difference = round(scoreB - scoreA);
    const [low, high] = [round(difference - benchmark.margin), round(difference + benchmark.margin)];

    return {
      id: benchmark.id,
      label: benchmark.label,
      a: scoreA,
      b: scoreB,
      difference,
      interval: { low, high },
      isSignificant: low > 0 || high < 0,
      ...(benchmark.note !== undefined && { note: benchmark.note }),
    };
  });
}

const scoreAxis = { label: 'Accuracy', domain: [0.2, 1], format: percent } as const;
const atlas = models[0] ?? { id: 'atlas-70b', label: 'Atlas 70B' };
const cirrus = models[1] ?? { id: 'cirrus-34b', label: 'Cirrus 34B' };

function InteractiveLeaderboard(): ReactNode {
  const [sort, setSort] = useState<DataTableSort>();
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);

  return (
    <Leaderboard
      title="Model leaderboard"
      description="Accuracy on the held-out suite, synthetic results. Change is reasoning accuracy against the last release. Calibration error is lower when confidence matches accuracy."
      locale={LOCALE}
      source="Synthetic evaluation suite, six models"
      models={models}
      columns={columns}
      rows={allRows}
      sort={sort}
      onSortChange={setSort}
      selected={selected}
      onSelectedChange={setSelected}
    />
  );
}

export const LeaderboardTable: Story = { name: 'Leaderboard', render: () => <InteractiveLeaderboard /> };

export const Breakdown: Story = {
  render: () => (
    <ToneScope ids={models.map((model) => model.id)}>
      <ScoreBreakdown
        title="Reasoning by subject"
        description="Accuracy with a 95% interval on each subject of the reasoning benchmark. Synthetic results."
        locale={LOCALE}
        models={models}
        categories={categories}
        scores={breakdown(['atlas-70b', 'cirrus-34b', 'atlas-13b'])}
        value={scoreAxis}
      />
    </ToneScope>
  ),
};

export const Comparison: Story = {
  render: () => (
    <ToneScope ids={models.map((model) => model.id)}>
      <ModelComparison
        title="Atlas 70B against Cirrus 34B"
        description="Accuracy on six benchmarks. Differences are Cirrus 34B minus Atlas 70B, with paired 95% intervals."
        locale={LOCALE}
        a={atlas}
        b={cirrus}
        rows={headToHead(atlas.id, cirrus.id)}
        value={scoreAxis}
        isHigherBetter
      />
    </ToneScope>
  ),
};

function ReportPage(): ReactNode {
  const [sort, setSort] = useState<DataTableSort>();
  const [selected, setSelected] = useState<ReadonlyArray<string>>(['atlas-70b', 'cirrus-34b', 'atlas-13b']);
  const [first, second] = models.filter((model) => selected.includes(model.id));

  return (
    <ToneScope ids={models.map((model) => model.id)}>
      <ChartLink>
        <article {...stylex.props(styles.page)}>
          <h1 {...stylex.props(styles.heading)}>November evaluation report</h1>
          <Leaderboard
            title="Leaderboard"
            description="Six models on the held-out suite, synthetic results. Rest on a row to mark the model below; check models to break down and compare them."
            locale={LOCALE}
            source="Synthetic evaluation suite"
            models={models}
            columns={reportColumns}
            rows={rowsFor(reportColumns)}
            sort={sort}
            onSortChange={setSort}
            selected={selected}
            onSelectedChange={setSelected}
          />
          <ScoreBreakdown
            title="Reasoning by subject"
            description="The checked models on each subject of the reasoning benchmark, with 95% intervals."
            locale={LOCALE}
            models={models}
            categories={categories}
            scores={breakdown(selected)}
            value={scoreAxis}
            emptyLabel="Check models in the leaderboard to break their reasoning score down."
          />
          {first !== undefined && second !== undefined ? (
            <ModelComparison
              title={`${first.label} against ${second.label}`}
              description={`The first two checked models. Differences are ${second.label} minus ${first.label}, with paired 95% intervals.`}
              locale={LOCALE}
              a={first}
              b={second}
              rows={headToHead(first.id, second.id)}
              value={scoreAxis}
              isHigherBetter
            />
          ) : (
            <Notice>Check two models in the leaderboard to compare them head to head.</Notice>
          )}
        </article>
      </ChartLink>
    </ToneScope>
  );
}

export const Report: Story = { render: () => <ReportPage /> };

const stateColumns = columns.slice(0, 2);
const stateRows = rowsFor(stateColumns);
const shared = { locale: LOCALE, models, columns: stateColumns } as const;

export const States: Story = {
  render: () => (
    <div {...stylex.props(styles.states)}>
      <Leaderboard {...shared} title="Loading" status="loading" rows={stateRows} />
      <Leaderboard {...shared} title="No results yet" rows={[]} />
      <Leaderboard
        {...shared}
        title="Partial: the first three models"
        coverage={{ shown: 3, total: 6, unit: 'models' }}
        rows={stateRows.slice(0, 3)}
      />
      <Leaderboard
        {...shared}
        title="Invalid: a score where an interval belongs"
        rows={[{ model: 'atlas-70b', values: { reasoning: 0.84 } }]}
      />
      <ScoreBreakdown
        title="Breakdown, loading"
        locale={LOCALE}
        status="loading"
        models={models}
        categories={categories}
        scores={[]}
        value={scoreAxis}
        height="compact"
      />
      <ModelComparison
        title="Comparison, invalid: a model against itself"
        locale={LOCALE}
        a={atlas}
        b={atlas}
        rows={headToHead(atlas.id, cirrus.id)}
        value={scoreAxis}
        isHigherBetter
      />
      <ModelComparison
        title="Comparison, loading"
        locale={LOCALE}
        status="loading"
        a={atlas}
        b={cirrus}
        rows={[]}
        value={scoreAxis}
        isHigherBetter
        height="compact"
      />
    </div>
  ),
};

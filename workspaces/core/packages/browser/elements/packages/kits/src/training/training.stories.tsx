import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SectionHeading } from '../../../core/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { RunDashboard } from './run-dashboard.tsx';
import type { MetricSeries, RunMetric } from './run-dashboard.tsx';
import { RunTable } from './run-table.tsx';
import type { RunTableMetric } from './run-table.tsx';
import { RunsOverview } from './runs-overview.tsx';
import type { RunRecord } from './runs.ts';

const meta = {
  title: 'Kits/Training',
  component: RunDashboard,
  subcomponents: { RunTable, RunsOverview },
  parameters: {
    docs: {
      description: {
        component:
          'What a team needs to watch and compare training runs. RunDashboard draws a panel of curves per metric with one hue per run and one step cursor that moves in every panel. RunTable lists the runs with their state, the settings that differ and their final results, and doubles as the legend: its checkboxes hide runs and a pressed row focuses one. RunsOverview shows a whole sweep as gray lines with a median. The application holds the focused run and the hidden runs and supplies prepared series. All data in these stories is synthetic and closed-form.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const STEP_SIZE = 250;
const STEP_COUNT = 41;
const steps = Array.from({ length: STEP_COUNT }, (_, index) => index * STEP_SIZE);
const percent = { style: 'percent', maximumFractionDigits: 1 } as const;
const decimals = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;
const lrFormat = { maximumFractionDigits: 4 } as const;
const stepAxis = { label: 'Training step', domain: [0, 10_000], format: { maximumFractionDigits: 0 } } as const;

type Setup = {
  readonly peak: number;
  readonly warmup: number;
  readonly decay: number;
  readonly floor: number;
  readonly speed: number;
  /** The last step with a recording, or null for a run that has gone on to the end. */
  readonly lastStep: number;
};

const trials: ReadonlyArray<{ readonly run: RunRecord; readonly setup: Setup }> = [
  {
    run: { id: 'baseline', label: 'baseline', detail: 'lr 3e-4, warmup 1k', state: 'finished' },
    setup: { peak: 3e-4, warmup: 1000, decay: 0.01, floor: 1.9, speed: 3200, lastStep: 10_000 },
  },
  {
    run: { id: 'fast', label: 'lr-1e-3', detail: 'lr 1e-3, warmup 1k', state: 'running' },
    setup: { peak: 1e-3, warmup: 1000, decay: 0.01, floor: 1.6, speed: 2200, lastStep: 7000 },
  },
  {
    run: { id: 'hot', label: 'lr-3e-3', detail: 'Loss became NaN at step 3,500', state: 'failed' },
    setup: { peak: 3e-3, warmup: 500, decay: 0.01, floor: 1.4, speed: 1400, lastStep: 3250 },
  },
  {
    run: { id: 'decayed', label: 'wd-0.1', detail: 'weight decay 0.1', state: 'stopped' },
    setup: { peak: 3e-4, warmup: 1000, decay: 0.1, floor: 1.75, speed: 3000, lastStep: 5000 },
  },
  {
    run: { id: 'warm', label: 'warmup-2k', detail: 'lr 3e-4, warmup 2k', state: 'finished' },
    setup: { peak: 3e-4, warmup: 2000, decay: 0.01, floor: 1.8, speed: 3400, lastStep: 10_000 },
  },
];

const runs = trials.map((trial) => trial.run);

function schedule(setup: Setup, step: number): number {
  if (step < setup.warmup) {
    return (setup.peak * step) / setup.warmup;
  }

  const progress = (step - setup.warmup) / (10_000 - setup.warmup);

  return setup.peak * (0.1 + 0.9 * 0.5 * (1 + Math.cos(Math.PI * progress)));
}

function loss(setup: Setup, step: number): number {
  const bump = setup.peak > 2e-3 ? 0.9 * Math.exp(-((step - 2500) ** 2) / 600_000) : 0;

  return setup.floor + (4.6 - setup.floor) * Math.exp(-step / setup.speed) + 0.04 * Math.sin(step / 170) + bump;
}

function measure(setup: Setup, metric: string, step: number): number {
  switch (metric) {
    case 'loss':
      return loss(setup, step);
    case 'accuracy':
      return 0.08 + 0.8 * Math.max(0, 1 - (loss(setup, step) - 1.2) / 3.4) ** 1.4;
    case 'lr':
      return schedule(setup, step);
    default:
      return (
        0.5 +
        2.2 * Math.exp(-step / 2600) +
        0.12 * Math.sin(step / 90) +
        (setup.peak > 2e-3 && step > 2000 ? 0.0015 * (step - 2000) : 0)
      );
  }
}

const series: MetricSeries = Object.fromEntries(
  ['loss', 'accuracy', 'lr', 'grad'].map((metric) => [
    metric,
    Object.fromEntries(
      trials.map(({ run, setup }) => [
        run.id,
        steps.filter((step) => step <= setup.lastStep).map((step) => ({ x: step, y: measure(setup, metric, step) })),
      ]),
    ),
  ]),
);

const firstTwo: MetricSeries = { loss: series['loss'] ?? {}, accuracy: series['accuracy'] ?? {} };

const metrics: ReadonlyArray<RunMetric> = [
  {
    id: 'loss',
    title: 'Training loss',
    description: 'Cross-entropy on training batches. Lower is better.',
    y: { label: 'Loss (nats)', format: decimals },
  },
  {
    id: 'accuracy',
    title: 'Validation accuracy',
    description: 'Share of held-out tokens predicted correctly. Higher is better.',
    y: { label: 'Accuracy', domain: [0, 1], format: percent },
  },
  {
    id: 'lr',
    title: 'Learning rate',
    description: 'The schedule each run follows: warmup, then cosine decay.',
    y: { label: 'Learning rate', domain: [0, 3.2e-3], format: lrFormat },
  },
  {
    id: 'grad',
    title: 'Gradient norm',
    description: 'Norm of the clipped gradient. Spikes often come before a failure.',
    y: { label: 'Norm', domain: [0, 12], format: { maximumFractionDigits: 1 } },
  },
];

const tableMetrics: ReadonlyArray<RunTableMetric> = [
  {
    id: 'final-loss',
    label: 'Final loss',
    kind: 'bar',
    format: decimals,
    domain: [0, 5],
    values: Object.fromEntries(runs.map((run) => [run.id, series['loss']?.[run.id]?.at(-1)?.y ?? null])),
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    kind: 'spark',
    format: percent,
    domain: [0, 1],
    values: Object.fromEntries(
      runs.map((run) => [run.id, (series['accuracy']?.[run.id] ?? []).map((point) => point.y)]),
    ),
  },
];

const columns = [
  {
    id: 'lr',
    label: 'Peak lr',
    format: lrFormat,
    values: Object.fromEntries(
      runs.map((run) => [run.id, trials.find((trial) => trial.run.id === run.id)?.setup.peak ?? null]),
    ),
  },
  {
    id: 'warmup',
    label: 'Warmup',
    format: { maximumFractionDigits: 0 },
    values: Object.fromEntries(
      runs.map((run) => [run.id, trials.find((trial) => trial.run.id === run.id)?.setup.warmup ?? null]),
    ),
  },
  {
    id: 'decay',
    label: 'Decay',
    format: { maximumFractionDigits: 2 },
    values: Object.fromEntries(
      runs.map((run) => [run.id, trials.find((trial) => trial.run.id === run.id)?.setup.decay ?? null]),
    ),
  },
  { id: 'optimizer', label: 'Optimizer', values: Object.fromEntries(runs.map((run) => [run.id, 'AdamW'])) },
] as const;

const styles = stylex.create({ page: { display: 'grid', gap: spacing.xl, maxWidth: 1100, minWidth: 0 } });

function DashboardStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlyArray<string>>([]);

  return (
    <RunDashboard
      title="Learning-rate sweep"
      description="Synthetic runs. Point at any panel to read every run at that step; focus a run to turn the others gray."
      locale="en-US"
      runs={runs}
      metrics={metrics}
      series={series}
      x={stepAxis}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      hidden={hidden}
      onHiddenChange={(ids) => setHidden(ids)}
    />
  );
}

export const Dashboard: Story = { render: () => <DashboardStory /> };

function TableStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('baseline');
  const [hidden, setHidden] = useState<ReadonlyArray<string>>([]);

  return (
    <RunTable
      title="Runs"
      locale="en-US"
      runs={runs}
      columns={columns}
      metrics={tableMetrics}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      hidden={hidden}
      onHiddenChange={(ids) => setHidden(ids)}
    />
  );
}

export const Table: Story = { render: () => <TableStory /> };

const SWEEP_SIZE = 48;

const sweep = Array.from({ length: SWEEP_SIZE }, (_, index) => {
  const floor = 1.3 + 1.1 * Math.abs(Math.sin(index * 1.7));
  const rate = 0.0006 + 0.0004 * Math.abs(Math.cos(index * 2.3));

  return {
    id: `run-${index + 1}`,
    label: `Run ${index + 1}`,
    points: steps.map((step) => ({
      x: step,
      y: floor + (4.4 - floor) * Math.exp(-rate * step) + 0.05 * Math.sin(step / 330 + index),
    })),
  };
});

const sweepMedian = {
  label: 'Median',
  points: steps.map((step, position) => {
    const sorted = sweep.map((run) => run.points[position]?.y ?? 0).toSorted((first, second) => first - second);

    return { x: step, center: sorted[24] ?? 0, lower: sorted[12] ?? 0, upper: sorted[36] ?? 0 };
  }),
};

function OverviewStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('run-7');

  return (
    <RunsOverview
      title="Loss across the sweep"
      description="Synthetic sweep of 48 runs. Press a run's line to select it."
      locale="en-US"
      runs={sweep}
      x={stepAxis}
      y={{ label: 'Loss (nats)', domain: [0, 5], format: decimals }}
      summary={sweepMedian}
      summaryText="48 runs · median final loss 2.23 · interquartile range 1.88 to 2.40"
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Overview: Story = { render: () => <OverviewStory /> };

function ExperimentStory(): ReactNode {
  const [selected, setSelected] = useState<string | null>('fast');
  const [hidden, setHidden] = useState<ReadonlyArray<string>>(['decayed']);

  return (
    <div {...stylex.props(styles.page)}>
      <SectionHeading title="Learning-rate sweep" />
      <RunTable
        title="Runs"
        locale="en-US"
        runs={runs}
        columns={columns}
        metrics={tableMetrics}
        showOnlyDifferences
        selected={selected}
        onSelectedChange={(id) => setSelected(id)}
        hidden={hidden}
        onHiddenChange={(ids) => setHidden(ids)}
      />
      <RunDashboard
        title="Curves"
        description="Synthetic runs. Press a row to focus a run; uncheck a row to hide its curves."
        locale="en-US"
        runs={runs}
        metrics={metrics}
        series={series}
        x={stepAxis}
        selected={selected}
        hidden={hidden}
        hasLegend={false}
      />
    </div>
  );
}

export const Experiment: Story = { render: () => <ExperimentStory /> };

export const States: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <RunDashboard
        title="Loading"
        locale="en-US"
        status="loading"
        runs={runs}
        metrics={metrics.slice(0, 2)}
        series={firstTwo}
        x={stepAxis}
      />
      <RunDashboard
        title="No runs yet"
        locale="en-US"
        runs={[]}
        metrics={metrics.slice(0, 2)}
        series={{}}
        x={stepAxis}
      />
      <RunDashboard
        title="Every run hidden"
        locale="en-US"
        runs={runs}
        metrics={metrics.slice(0, 2)}
        series={firstTwo}
        x={stepAxis}
        hidden={runs.map((run) => run.id)}
      />
      <RunDashboard
        title="Partial and smoothed"
        locale="en-US"
        runs={runs}
        metrics={metrics.slice(0, 2)}
        series={firstTwo}
        x={stepAxis}
        coverage={{ shown: 41, total: 2000, unit: 'steps' }}
        transforms={['Smoothed over 5 steps']}
      />
      <RunDashboard
        title="Invalid series"
        locale="en-US"
        runs={runs}
        metrics={metrics.slice(0, 2)}
        series={{ loss: { missing: [{ x: 0, y: 1 }] } }}
        x={stepAxis}
      />
      <RunTable
        title="Loading runs"
        locale="en-US"
        status="loading"
        runs={runs}
        columns={columns}
        metrics={tableMetrics}
      />
      <RunTable title="No runs yet" locale="en-US" runs={[]} />
    </div>
  ),
};

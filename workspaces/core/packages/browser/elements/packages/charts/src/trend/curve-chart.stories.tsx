import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import { CurveChart } from './curve-chart.tsx';
import type { CurveSeries } from './curve-chart.tsx';

const meta = {
  title: 'Charts/CurveChart',
  component: CurveChart,
  parameters: {
    docs: {
      description: {
        component:
          'Charts of a measure over an ordered variable that is not a timestamp: a training step, a layer, a dose. CurveChart draws supplied observations on linear, log or symlog axes, breaks at missing values, shades supplied intervals and dashes modelled series. The application computes every value, bound and reference.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const FIRST_STEP = 100;
const steps = [FIRST_STEP, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];

function loss({ start, floor, rate }: { readonly start: number; readonly floor: number; readonly rate: number }) {
  return steps.map((step) => {
    const value = floor + (start - floor) * Math.exp(-rate * Math.log10(step / FIRST_STEP));

    return { x: step, y: value, lower: value * 0.92, upper: value * 1.08 };
  });
}

const training: ReadonlyArray<CurveSeries> = [
  { id: 'base', label: 'Base', points: loss({ start: 4.2, floor: 1.9, rate: 1.1 }) },
  { id: 'wide', label: 'Wide', points: loss({ start: 4.1, floor: 1.6, rate: 1.3 }) },
  {
    id: 'fit',
    label: 'Power-law fit',
    stroke: 'dashed',
    tone: 'neutral',
    points: steps.map((step) => ({ x: step, y: 5.6 * step ** -0.11 })),
  },
];

const number = { maximumFractionDigits: 2 } as const;

export const TrainingLoss: Story = {
  render: () => (
    <CurveChart
      title="Validation loss"
      description="Synthetic runs. Bands span three seeds; the dashed line is a fitted power law."
      locale="en-US"
      series={training}
      x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Loss (nats)', domain: [1, 5], format: number }}
      references={[{ id: 'target', label: 'Target', y: 1.75 }]}
      source="Synthetic sweep"
      transforms={['Mean of three seeds']}
    />
  ),
};

const layers = Array.from({ length: 12 }, (_, layer) => layer);

const probes: ReadonlyArray<CurveSeries> = [
  {
    id: 'syntax',
    label: 'Syntax probe',
    points: layers.map((layer) => ({ x: layer, y: layer === 7 ? null : 0.4 + 0.5 * Math.sin((layer / 11) * Math.PI) })),
  },
  { id: 'semantics', label: 'Semantic probe', points: layers.map((layer) => ({ x: layer, y: 0.3 + 0.055 * layer })) },
  {
    id: 'chance',
    label: 'Chance',
    isContext: true,
    stroke: 'dashed',
    points: layers.map((layer) => ({ x: layer, y: 0.25 })),
  },
];

export const ByLayer: Story = {
  render: () => (
    <CurveChart
      title="Probe accuracy by layer"
      description="Synthetic probes. Layer 7 has no syntax measurement, so the line breaks there. The guide marks the selected layer."
      locale="en-US"
      series={probes}
      x={{ label: 'Layer', domain: [0, 11], format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Accuracy', domain: [0, 1], format: { style: 'percent' } }}
      markers={[{ x: 9, label: 'Selected layer 9' }]}
      labels="inline"
      height="compact"
    />
  ),
};

export const LinkedPanels: Story = {
  render: () => (
    <ChartGrid
      title="Two metrics, one sweep"
      description="Pointing at a step in one panel marks the same step in the other. Each run keeps its hue."
      ids={['base', 'wide']}
    >
      <CurveChart
        title="Loss"
        locale="en-US"
        series={training.slice(0, 2)}
        x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
        y={{ label: 'Loss (nats)', format: number }}
        height="compact"
      />
      <CurveChart
        title="Accuracy"
        locale="en-US"
        series={training
          .slice(0, 2)
          .map((item) => ({
            ...item,
            points: item.points.map((point) => ({ x: point.x, y: point.y === null ? null : 1 / point.y })),
          }))}
        x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
        y={{ label: 'Accuracy', format: { style: 'percent' } }}
        height="compact"
      />
    </ChartGrid>
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <CurveChart
        title="Loading"
        locale="en-US"
        status="loading"
        series={[]}
        x={{ label: 'Step', format: number }}
        y={{ label: 'Loss', format: number }}
        height="compact"
      />
      <CurveChart
        title="Empty"
        locale="en-US"
        series={[]}
        x={{ label: 'Step', format: number }}
        y={{ label: 'Loss', format: number }}
        height="compact"
      />
      <CurveChart
        title="Partial"
        locale="en-US"
        coverage={{ shown: 1000, total: 1_200_000, unit: 'steps' }}
        series={training.slice(0, 1)}
        x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
        y={{ label: 'Loss (nats)', format: number }}
        height="compact"
      />
      <CurveChart
        title="Invalid"
        locale="en-US"
        series={training.slice(0, 1)}
        x={{ label: 'Training step', scale: 'log', domain: [0, 10], format: number }}
        y={{ label: 'Loss (nats)', format: number }}
        height="compact"
      />
    </ChartGrid>
  ),
};

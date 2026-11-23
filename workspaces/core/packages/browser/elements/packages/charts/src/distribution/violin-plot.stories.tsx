import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import type { DensityPoint } from './group-plot-input.ts';
import { ViolinPlot } from './violin-plot.tsx';
import type { ViolinGroup } from './violin-plot.tsx';

const meta = {
  title: 'Charts/ViolinPlot',
  component: ViolinPlot,
  parameters: {
    docs: {
      description: {
        component:
          'A mirrored density per group, so a reader sees where values pile up and whether a distribution has two peaks. All violins share one density scale, so widths compare across groups. A bar and a dot inside show the quartiles and median the application supplies. The application computes the density; the stories use synthetic curves.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const POINTS = 41;
const SQRT_TAU = Math.sqrt(2 * Math.PI);

function bell({ mean, spread, weight }: { readonly mean: number; readonly spread: number; readonly weight: number }) {
  return (value: number) => (weight / (spread * SQRT_TAU)) * Math.exp(-0.5 * ((value - mean) / spread) ** 2);
}

function curve(parts: ReadonlyArray<(value: number) => number>): ReadonlyArray<DensityPoint> {
  return Array.from({ length: POINTS }, (_, index) => {
    const value = index / (POINTS - 1);

    return { value, density: parts.reduce((total, part) => total + part(value), 0) };
  });
}

const scores: ReadonlyArray<ViolinGroup> = [
  {
    id: 'sft',
    label: 'SFT',
    density: curve([bell({ mean: 0.55, spread: 0.12, weight: 1 })]),
    q1: 0.47,
    median: 0.55,
    q3: 0.63,
  },
  {
    id: 'rlhf',
    label: 'RLHF',
    density: curve([bell({ mean: 0.7, spread: 0.08, weight: 1 })]),
    q1: 0.65,
    median: 0.7,
    q3: 0.76,
  },
  {
    id: 'mixed',
    label: 'Mixed',
    density: curve([bell({ mean: 0.3, spread: 0.07, weight: 0.45 }), bell({ mean: 0.75, spread: 0.07, weight: 0.55 })]),
    median: 0.62,
  },
  { id: 'base', label: 'Base', density: curve([bell({ mean: 0.4, spread: 0.18, weight: 1 })]) },
];

export const RewardScores: Story = {
  render: () => (
    <ViolinPlot
      title="Reward score by training recipe"
      description="Synthetic scores. Mixed has two peaks that a single summary would hide. All violins share one density scale. Mixed gives a median and no quartiles; Base gives neither."
      locale="en-US"
      groups={scores}
      value={{ label: 'Reward score', domain: [0, 1], format: { maximumFractionDigits: 2 } }}
      densityLabel="density of responses"
      source="Synthetic evaluation"
      height="tall"
    />
  ),
};

export const States: Story = {
  render: () => {
    const axis = { label: 'Reward score', domain: [0, 1], format: { maximumFractionDigits: 2 } } as const;

    return (
      <ChartGrid title="Every state has one look">
        <ViolinPlot
          title="Loading"
          locale="en-US"
          status="loading"
          groups={[]}
          value={axis}
          densityLabel="density"
          height="compact"
        />
        <ViolinPlot title="Empty" locale="en-US" groups={[]} value={axis} densityLabel="density" height="compact" />
        <ViolinPlot
          title="Partial"
          locale="en-US"
          coverage={{ shown: 500, total: 90_000, unit: 'responses' }}
          groups={scores.slice(0, 2)}
          value={axis}
          densityLabel="density"
          height="compact"
        />
        <ViolinPlot
          title="Invalid"
          locale="en-US"
          groups={[
            {
              id: 'bad',
              label: 'Bad',
              density: [
                { value: 0.5, density: 1 },
                { value: 0.2, density: 1 },
              ],
            },
          ]}
          value={axis}
          densityLabel="density"
          height="compact"
        />
      </ChartGrid>
    );
  },
};

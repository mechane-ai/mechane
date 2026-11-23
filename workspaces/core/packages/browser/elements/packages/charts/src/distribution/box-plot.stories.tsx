import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import { BoxPlot } from './box-plot.tsx';
import type { BoxGroup } from './box-plot.tsx';

const meta = {
  title: 'Charts/BoxPlot',
  component: BoxPlot,
  parameters: {
    docs: {
      description: {
        component:
          'One box per group: the middle half of its values, a median line, whiskers and hollow dots for outliers beyond them. Use it to compare spread and center across models, layers or runs. The application computes every number and says what the whiskers mean. The stories use synthetic data.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const latency: ReadonlyArray<BoxGroup> = [
  { id: 'small', label: 'Small', low: 38, q1: 46, median: 52, q3: 61, high: 80, outliers: [96, 112], count: 4000 },
  { id: 'base', label: 'Base', low: 61, q1: 74, median: 83, q3: 97, high: 126, outliers: [151, 170, 188], count: 4000 },
  { id: 'large', label: 'Large', low: 118, q1: 141, median: 160, q3: 184, high: 232, outliers: [], count: 4000 },
  { id: 'distilled', label: 'Distilled', low: 30, q1: 38, median: 43, q3: 49, high: 64, outliers: [77], count: 3500 },
];

const milliseconds = { maximumFractionDigits: 0 } as const;
const whiskers = 'Whiskers reach 1.5 × IQR';

export const ServingLatency: Story = {
  render: () => (
    <BoxPlot
      title="Serving latency by model"
      description="Synthetic request latencies. The box spans the middle half of requests and the line inside it is the median."
      locale="en-US"
      groups={latency}
      value={{ label: 'Latency (ms)', domain: [0, 250], format: milliseconds }}
      whiskerLabel={whiskers}
      source="Synthetic load test"
      transforms={['Five-number summaries per model']}
    />
  ),
};

const layers = ['L0', 'L4', 'L8', 'L12', 'L16', 'L20'].map((label, index): BoxGroup => {
  const center = 0.2 + 0.1 * index;

  return {
    id: label,
    label: `Layer ${label.slice(1)}`,
    low: center - 0.18,
    q1: center - 0.07,
    median: center,
    q3: center + 0.06 + 0.01 * index,
    high: center + 0.2,
    outliers: index % 2 === 0 ? [center + 0.32] : [center - 0.3, center + 0.34],
  };
});

export const RowsWithoutCount: Story = {
  render: () => (
    <BoxPlot
      title="Attention entropy by layer"
      description="Synthetic entropy per head. Rows suit long names; no observation counts are supplied here."
      locale="en-US"
      direction="rows"
      groups={layers}
      value={{ label: 'Entropy (nats)', domain: [-0.2, 1.2], format: { maximumFractionDigits: 2 } }}
      whiskerLabel="Whiskers reach the furthest head within 1.5 × IQR"
    />
  ),
};

export const States: Story = {
  render: () => {
    const axis = { label: 'Latency (ms)', domain: [0, 250], format: milliseconds } as const;

    return (
      <ChartGrid title="Every state has one look">
        <BoxPlot
          title="Loading"
          locale="en-US"
          status="loading"
          groups={[]}
          value={axis}
          whiskerLabel={whiskers}
          height="compact"
        />
        <BoxPlot title="Empty" locale="en-US" groups={[]} value={axis} whiskerLabel={whiskers} height="compact" />
        <BoxPlot
          title="Partial"
          locale="en-US"
          coverage={{ shown: 8000, total: 2_400_000, unit: 'requests' }}
          groups={latency.slice(0, 2)}
          value={axis}
          whiskerLabel={whiskers}
          height="compact"
        />
        <BoxPlot
          title="Invalid"
          locale="en-US"
          groups={[{ id: 'bad', label: 'Bad', low: 10, q1: 40, median: 30, q3: 50, high: 60 }]}
          value={axis}
          whiskerLabel={whiskers}
          height="compact"
        />
      </ChartGrid>
    );
  },
};

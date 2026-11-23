import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Columns, Panel, Stack } from '../../../core/src/index.ts';
import { ECDF } from './ecdf.tsx';
import { Histogram } from './histogram.tsx';
import type { HistogramBin } from './histogram.tsx';
import { IntervalPlot } from './interval-plot.tsx';
import type { IntervalDatum } from './interval-plot.tsx';
import { RankedBars } from './ranked-bars.tsx';
import type { RankedBarDatum } from './ranked-bars.tsx';

const meta = {
  title: 'Charts/Distributions',
  component: Histogram,
  subcomponents: { ECDF, IntervalPlot, RankedBars },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Applications prepare histogram bins, cumulative probabilities, interval estimates, and ranked values. Charts preserve that order and never estimate missing measurements, aggregate samples, or infer a confidence level. Declare each axis with its label and unit, a format and an optional domain; Histogram fits its count axis from zero and ECDF uses zero to one when no domain is given. View data exposes each plotted value and supports keyboard or touch selection. A null value remains unavailable; an actual zero retains its label and baseline position. Histogram accepts at most 200 bins, ECDF 2,000 points, and interval/ranked plots 200 rows. Invalid or oversized data produces an error instead of a partial chart. The application owns windowing and aggregation.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const bins: ReadonlyArray<HistogramBin> = [
  { id: 'fast', label: '0–100 ms', lowerBound: 0, upperBound: 100, count: 24 },
  { id: 'typical', label: '100–200 ms', lowerBound: 100, upperBound: 200, count: 52 },
  { id: 'slow', label: '200–300 ms', lowerBound: 200, upperBound: 300, count: 18 },
  { id: 'empty', label: '300–400 ms', lowerBound: 300, upperBound: 400, count: 0 },
  { id: 'unrecorded', label: '400–500 ms', lowerBound: 400, upperBound: 500, count: null },
];

const intervalItems: ReadonlyArray<IntervalDatum> = [
  { id: 'baseline', label: 'Baseline', lower: 0.67, estimate: 0.73, upper: 0.78 },
  { id: 'candidate', label: 'Candidate', lower: 0.72, estimate: 0.79, upper: 0.85, tone: 'series2' },
  {
    id: 'point-only',
    label: 'Point estimate from a run without recorded interval endpoints',
    lower: null,
    estimate: 0.76,
    upper: null,
    tone: 'series3',
  },
  { id: 'unknown', label: 'Evaluation pending', lower: null, estimate: null, upper: null },
];

const rankedItems: ReadonlyArray<RankedBarDatum> = [
  { id: 'bracket', rank: '1', label: 'Closing bracket feature', value: 1.7, tone: 'series1' },
  { id: 'separator', rank: '2', label: 'Separator feature', value: -1.1, tone: 'series4' },
  { id: 'indent', rank: '3', label: 'Indentation feature', value: 0.6, tone: 'series1' },
  { id: 'zero', rank: '4', label: 'Measured zero', value: 0, tone: 'series1' },
  { id: 'missing', label: 'Feature with no recorded score in the selected analysis window', value: null },
];

const latency = { label: 'Latency (ms)', domain: [0, 500], format: { maximumFractionDigits: 1 } } as const;
const requests = { label: 'Requests', domain: [0, 60], format: { maximumFractionDigits: 0 } } as const;
const percent = { style: 'percent', maximumFractionDigits: 0 } as const;
const accuracy = { label: 'Accuracy', domain: [0.6, 0.9], format: percent } as const;
const contribution = { label: 'Contribution score', domain: [-2, 2], format: { maximumFractionDigits: 1 } } as const;

function DistributionExamples(): ReactNode {
  const [selectedBin, setSelectedBin] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<string | null>(null);

  return (
    <Columns>
      <Panel>
        <Histogram
          title="Request latency"
          description="Recorded counts by declared latency bin · synthetic sample"
          locale="en-US"
          bins={bins}
          value={latency}
          count={requests}
          selected={selectedBin}
          onSelectedChange={setSelectedBin}
        />
      </Panel>
      <Panel>
        <IntervalPlot
          title="Evaluation estimates"
          description="Intervals are supplied by the evaluation, not calculated by the chart."
          locale="en-US"
          items={intervalItems}
          value={accuracy}
          intervalLabel="95% bootstrap interval"
          selected={selectedInterval}
          onSelectedChange={setSelectedInterval}
        />
      </Panel>
    </Columns>
  );
}

function SignedExamples(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Panel>
      <RankedBars
        title="Feature contributions"
        description="Supplied attribution scores, ordered by the analysis owner."
        locale="en-US"
        items={rankedItems}
        value={contribution}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <RankedBars
        title="Compact ranked list"
        description="A short list for a card: height compact keeps each row tight."
        locale="en-US"
        height="compact"
        items={rankedItems.slice(0, 3)}
        value={contribution}
      />
    </Panel>
  );
}

function CumulativeExample(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Panel>
      <ECDF
        title="Cumulative request latency"
        description="Prepared empirical probabilities. The missing sample creates a visible gap."
        locale="en-US"
        points={[
          { id: 'start', value: 0, probability: 0 },
          { id: 'one', value: 70, probability: 0.14 },
          { id: 'two', value: 120, probability: 0.38 },
          { id: 'missing', value: 180, probability: null },
          { id: 'four', value: 240, probability: 0.8 },
          { id: 'five', value: 400, probability: 1 },
        ]}
        value={latency}
        probability={{ label: 'Requests at or below latency', format: percent }}
        selected={selected}
        onSelectedChange={setSelected}
      />
    </Panel>
  );
}

export const Recommended: Story = { render: () => <DistributionExamples /> };
export const SignedAndMissing: Story = { render: () => <SignedExamples /> };
export const PreparedCumulativeDistribution: Story = { render: () => <CumulativeExample /> };

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <Stack>
      <DistributionExamples />
      <SignedExamples />
      <CumulativeExample />
    </Stack>
  ),
};

export const Empty: Story = {
  render: () => (
    <Columns>
      <Panel>
        <Histogram title="Request latency" locale="en-US" bins={[]} value={latency} count={requests} />
      </Panel>
      <Panel>
        <RankedBars title="Feature scores" locale="en-US" items={[]} value={{ ...contribution, label: 'Score' }} />
      </Panel>
    </Columns>
  ),
};

export const ZeroIsNotUnavailable: Story = {
  render: () => (
    <Panel>
      <Histogram
        title="No requests in recorded bins"
        description="Zero counts have no bar height. Unavailable counts use a dashed marker."
        bins={[
          { id: 'zero', label: 'Recorded', lowerBound: 0, upperBound: 100, count: 0 },
          { id: 'unknown', label: 'Unavailable', lowerBound: 100, upperBound: 200, count: null },
        ]}
        locale="en-US"
        value={{ ...latency, domain: [0, 200] }}
        count={{ ...requests, domain: [0, 1] }}
      />
    </Panel>
  ),
};

export const InvalidEvidence: Story = {
  render: () => (
    <Columns>
      <Panel>
        <Histogram
          title="Overlapping bins"
          bins={[
            { id: 'first', label: 'First range', lowerBound: 0, upperBound: 200, count: 12 },
            { id: 'overlap', label: 'Overlapping range', lowerBound: 100, upperBound: 300, count: 8 },
          ]}
          locale="en-US"
          value={latency}
          count={{ ...requests, domain: [0, 20] }}
        />
      </Panel>
      <Panel>
        <IntervalPlot
          title="Reversed interval"
          items={[{ id: 'reversed', label: 'Invalid estimate', lower: 0.9, estimate: 0.8, upper: 0.7 }]}
          locale="en-US"
          value={{ ...accuracy, domain: [0, 1] }}
          intervalLabel="95% bootstrap interval"
        />
      </Panel>
    </Columns>
  ),
};

export const ExplicitRenderLimit: Story = {
  render: () => (
    <Panel>
      <RankedBars
        title="An input window is required"
        description="The chart does not silently show only the first 200 values."
        items={Array.from({ length: 201 }, (_, index) => ({
          id: `feature-${index}`,
          label: `Feature ${index}`,
          value: index,
        }))}
        locale="en-US"
        value={{ label: 'Activation magnitude', domain: [0, 201], format: { maximumFractionDigits: 0 } }}
      />
    </Panel>
  ),
};

export const States: Story = {
  render: () => (
    <Columns>
      <Panel>
        <Histogram title="Request latency" locale="en-US" status="loading" bins={[]} value={latency} count={requests} />
      </Panel>
      <Panel>
        <Histogram
          title="Request latency"
          description="Counts from a sampled window · synthetic sample"
          locale="en-US"
          bins={bins}
          value={latency}
          count={{ label: 'Requests', format: { maximumFractionDigits: 0 } }}
          coverage={{ shown: 94, total: 1200, unit: 'requests' }}
          source="Synthetic latency sample"
          transforms={['Binned at 100 ms']}
        />
      </Panel>
    </Columns>
  ),
};

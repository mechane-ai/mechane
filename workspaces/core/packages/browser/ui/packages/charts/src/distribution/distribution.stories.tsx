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
          'Supported. Applications prepare histogram bins, cumulative probabilities, interval estimates, and ranked values. Charts preserve that order and never estimate missing measurements, aggregate samples, or infer a confidence level. Supply finite increasing domains, units, and formatters. View data exposes each plotted value and supports keyboard or touch selection. A null value remains unavailable; an actual zero retains its label and baseline position. Histogram accepts at most 200 bins, ECDF 2,000 points, and interval/ranked plots 200 rows. Invalid or oversized data produces an error instead of a partial chart. The application owns windowing and aggregation.',
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
  { id: 'point-only', label: 'Point estimate only', lower: null, estimate: 0.76, upper: null, tone: 'series3' },
  { id: 'unknown', label: 'Evaluation pending', lower: null, estimate: null, upper: null },
];

const rankedItems: ReadonlyArray<RankedBarDatum> = [
  { id: 'bracket', rank: '1', label: 'Closing bracket feature', value: 1.7, tone: 'series1' },
  { id: 'separator', rank: '2', label: 'Separator feature', value: -1.1, tone: 'series4' },
  { id: 'indent', rank: '3', label: 'Indentation feature', value: 0.6, tone: 'series1' },
  { id: 'zero', rank: '4', label: 'Measured zero', value: 0 },
  { id: 'missing', label: 'Feature with no recorded score', value: null },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function formatMilliseconds(value: number): string {
  return `${formatNumber(value)} ms`;
}

function formatProbability(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

function DistributionExamples(): ReactNode {
  const [selectedBin, setSelectedBin] = useState<string>();
  const [selectedInterval, setSelectedInterval] = useState<string>();

  return (
    <Columns>
      <Panel>
        <Histogram
          title="Request latency"
          description="Recorded counts by declared latency bin · synthetic sample"
          bins={bins}
          domain={[0, 500]}
          maximumCount={60}
          valueLabel="Latency"
          countLabel="Requests"
          formatValue={formatMilliseconds}
          formatCount={formatNumber}
          selection={{ selectedId: selectedBin, onSelect: setSelectedBin }}
        />
      </Panel>
      <Panel>
        <IntervalPlot
          title="Evaluation estimates"
          description="Intervals are supplied by the evaluation, not calculated by the chart."
          items={intervalItems}
          domain={[0.6, 0.9]}
          valueLabel="Accuracy"
          intervalLabel="95% bootstrap interval"
          formatValue={formatProbability}
          selection={{ selectedId: selectedInterval, onSelect: setSelectedInterval }}
        />
      </Panel>
    </Columns>
  );
}

function SignedExamples(): ReactNode {
  const [selectedId, onSelect] = useState<string>();

  return (
    <Panel>
      <RankedBars
        title="Feature contributions"
        description="Supplied attribution scores, ordered by the analysis owner."
        items={rankedItems}
        domain={[-2, 2]}
        valueLabel="Contribution score"
        formatValue={formatNumber}
        selection={{ selectedId, onSelect }}
      />
    </Panel>
  );
}

function CumulativeExample(): ReactNode {
  const [selectedId, onSelect] = useState<string>();

  return (
    <Panel>
      <ECDF
        title="Cumulative request latency"
        description="Prepared empirical probabilities. The missing sample creates a visible gap."
        points={[
          { id: 'start', value: 0, probability: 0 },
          { id: 'one', value: 70, probability: 0.14 },
          { id: 'two', value: 120, probability: 0.38 },
          { id: 'missing', value: 180, probability: null },
          { id: 'four', value: 240, probability: 0.8 },
          { id: 'five', value: 400, probability: 1 },
        ]}
        domain={[0, 500]}
        valueLabel="Latency"
        probabilityLabel="Requests at or below latency"
        formatValue={formatMilliseconds}
        formatProbability={formatProbability}
        selection={{ selectedId, onSelect }}
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
        <Histogram
          title="Request latency"
          bins={[]}
          domain={[0, 500]}
          maximumCount={60}
          valueLabel="Latency"
          countLabel="Requests"
          formatValue={formatMilliseconds}
          formatCount={formatNumber}
        />
      </Panel>
      <Panel>
        <RankedBars title="Feature scores" items={[]} domain={[-2, 2]} valueLabel="Score" formatValue={formatNumber} />
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
        domain={[0, 200]}
        maximumCount={1}
        valueLabel="Latency"
        countLabel="Requests"
        formatValue={formatMilliseconds}
        formatCount={formatNumber}
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
          domain={[0, 500]}
          maximumCount={20}
          valueLabel="Latency"
          countLabel="Requests"
          formatValue={formatMilliseconds}
          formatCount={formatNumber}
        />
      </Panel>
      <Panel>
        <IntervalPlot
          title="Reversed interval"
          items={[{ id: 'reversed', label: 'Invalid estimate', lower: 0.9, estimate: 0.8, upper: 0.7 }]}
          domain={[0, 1]}
          valueLabel="Accuracy"
          intervalLabel="95% bootstrap interval"
          formatValue={formatProbability}
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
        domain={[0, 201]}
        valueLabel="Activation magnitude"
        formatValue={formatNumber}
      />
    </Panel>
  ),
};

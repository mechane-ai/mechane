import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack, Text } from '../../../core/src/index.ts';
import { ScatterPlot } from './scatter-plot.tsx';
import type { ScatterPoint, ScatterRange } from './scatter-plot.tsx';

const meta = {
  title: 'Charts/Scatter plot',
  component: ScatterPlot,
  parameters: {
    docs: {
      description: {
        component:
          'ScatterPlot displays supplied coordinates without computing an embedding or interpreting distance. Applications declare axis meanings, units, domains, and formatters. Point selection and range selection are controlled independently. Drag an empty area with a mouse to select a rectangle; the two range sliders provide the same coordinate selection with keyboard and touch. Touch gestures on the plot scroll the page. The data disclosure preserves every supplied label and coordinate. Supply no more than 1,000 points. Invalid or out-of-domain coordinates produce an explicit error rather than a clamped mark. Windowing or sampling belongs to the application and must be described beside the plot.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatCoordinate(value: number): string {
  return numberFormat.format(value);
}

const points: ReadonlyArray<ScatterPoint> = [
  { id: 'sample-river', label: 'River passage', x: -2.4, y: 1.8, tone: 'series1' },
  { id: 'sample-lake', label: 'Lake passage', x: -1.8, y: 1.3, tone: 'series1' },
  { id: 'sample-stream', label: 'Stream passage', x: -2.1, y: 2.4, tone: 'series1' },
  { id: 'sample-canal', label: 'Canal passage', x: -1.3, y: 2.1, tone: 'series1' },
  { id: 'sample-channel', label: 'Channel passage', x: -2.7, y: 0.9, tone: 'series1' },
  { id: 'sample-map', label: 'Map passage', x: 0.9, y: -1.3, tone: 'series2' },
  { id: 'sample-road', label: 'Road passage', x: 1.5, y: -1.8, tone: 'series2' },
  { id: 'sample-street', label: 'Street passage', x: 1.8, y: -0.9, tone: 'series2' },
  { id: 'sample-rail', label: 'Rail passage', x: 0.6, y: -2.4, tone: 'series2' },
  { id: 'sample-path', label: 'Path passage', x: 2.1, y: -2.1, tone: 'series2' },
  { id: 'sample-bridge', label: 'Bridge passage', x: 0, y: 0, tone: 'series3' },
  { id: 'sample-port', label: 'Port passage', x: -0.4, y: 0.7, tone: 'series3' },
];

function Embedding(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();
  const [range, setRange] = useState<ScatterRange | null>(null);
  const selected = points.find((point) => point.id === selectedId);

  const selectedCount =
    range === null
      ? 0
      : points.filter((point) => {
          const isInsideXRange = point.x >= range.x[0] && point.x <= range.x[1];
          const isInsideYRange = point.y >= range.y[0] && point.y <= range.y[1];

          return isInsideXRange && isInsideYRange;
        }).length;

  return (
    <Panel>
      <Stack>
        <ScatterPlot
          title="Embedding inspection"
          description="Twelve synthetic samples with supplied projection coordinates. Colors identify source categories. This view does not estimate similarity or a causal relationship."
          points={points}
          xDomain={[-3, 3]}
          yDomain={[-3, 3]}
          xLabel="Projection 1 (unitless)"
          yLabel="Projection 2 (unitless)"
          formatX={formatCoordinate}
          formatY={formatCoordinate}
          selection={{ selectedId, onSelect: setSelectedId }}
          rangeSelection={{ value: range, onChange: setRange, xStep: 0.1, yStep: 0.1, locale: 'en-US' }}
          emptyLabel="No projected points were supplied."
        />
        <Text tone="muted">
          {selected === undefined
            ? 'Select a point to inspect its label and coordinates.'
            : `${selected.label}: (${formatCoordinate(selected.x)}, ${formatCoordinate(selected.y)})`}
        </Text>
        <Text tone="muted">
          {range === null
            ? 'No range is selected.'
            : `The application counted ${selectedCount} supplied points inside the selected range.`}
        </Text>
      </Stack>
    </Panel>
  );
}

export const SelectPointsAndRanges: Story = { render: () => <Embedding /> };

export const ReadOnly: Story = {
  render: () => (
    <Panel>
      <ScatterPlot
        title="Projected samples"
        description="The complete twelve-record synthetic input, with no selection controls."
        points={points}
        xDomain={[-3, 3]}
        yDomain={[-3, 3]}
        xLabel="Projection 1 (unitless)"
        yLabel="Projection 2 (unitless)"
        formatX={formatCoordinate}
        formatY={formatCoordinate}
        emptyLabel="No projected points were supplied."
      />
    </Panel>
  ),
};

export const Empty: Story = {
  render: () => (
    <ScatterPlot
      title="Projected samples"
      description="No records have been supplied."
      points={[]}
      xDomain={[-3, 3]}
      yDomain={[-3, 3]}
      xLabel="Projection 1 (unitless)"
      yLabel="Projection 2 (unitless)"
      formatX={formatCoordinate}
      formatY={formatCoordinate}
      emptyLabel="No projected points were supplied."
    />
  ),
};

export const OutOfDomain: Story = {
  render: () => (
    <ScatterPlot
      title="Invalid projection domain"
      description="The supplied point falls outside the stated domain and is not moved to the edge."
      points={[{ id: 'outside', label: 'Outside the visible domain', x: 6, y: 0, tone: 'series1' }]}
      xDomain={[-3, 3]}
      yDomain={[-3, 3]}
      xLabel="Projection 1 (unitless)"
      yLabel="Projection 2 (unitless)"
      formatX={formatCoordinate}
      formatY={formatCoordinate}
      emptyLabel="No projected points were supplied."
    />
  ),
};

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <Embedding />,
};

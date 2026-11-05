import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Details } from '../../../collections/src/index.ts';
import { Muted, Panel, Stack } from '../../../core/src/index.ts';
import { Waterfall } from './waterfall.tsx';
import type { WaterfallItem } from './waterfall.tsx';

const meta = {
  title: 'Charts/Waterfall',
  component: Waterfall,
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Waterfall compares recorded intervals and points on one scale, with controlled selection and accessible textual timing. The application supplies stable IDs, labels, units, domain bounds, and explicit geometry. An interval needs both endpoints; a point records one known instant; unavailable means no drawable timing. Invalid or out-of-domain timing produces an error. Keep a missing endpoint unknown instead of substituting the current time. Use a table when ordering and values matter more than timing. Select a row with the pointer or Enter/Space to expose its full detail and exact timing. The optional selectedRef exposes the selected native button so an owning Inspector can restore focus when returning from narrow detail. Selection alone never moves focus or scrolls.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const intervals: ReadonlyArray<WaterfallItem> = [
  {
    id: 'prepare',
    label: 'Prepare inputs',
    detail: 'Read to ready',
    summary: '350 ms',
    tone: 'positive',
    geometry: { kind: 'interval', start: 0, end: 350 },
  },
  {
    id: 'assemble',
    label: 'Assemble output',
    detail: 'Started before preparation ended',
    summary: '630 ms',
    tone: 'positive',
    geometry: { kind: 'interval', start: 220, end: 850 },
  },
  {
    id: 'publish',
    label: 'Publish output',
    detail: 'Ready to recorded',
    summary: '200 ms',
    tone: 'neutral',
    geometry: { kind: 'interval', start: 900, end: 1100 },
  },
];

const partialTiming: ReadonlyArray<WaterfallItem> = [
  ...intervals,
  {
    id: 'instant',
    label: 'Recorded event',
    detail: 'One known instant',
    summary: 'At 900 ms',
    tone: 'neutral',
    geometry: { kind: 'point', at: 900, marker: 'filled' },
  },
  {
    id: 'waiting',
    label: 'Awaiting completion',
    detail: 'The endpoint is not recorded',
    summary: 'Pending',
    tone: 'neutral',
    geometry: { kind: 'point', at: 1000, marker: 'hollow' },
  },
  {
    id: 'declined',
    label: 'Declined operation',
    detail: 'The operation did not start',
    summary: 'Declined',
    tone: 'negative',
    geometry: { kind: 'point', at: 1100, marker: 'diamond' },
  },
  {
    id: 'unknown',
    label: 'Unavailable timing',
    detail: 'No measured endpoints',
    summary: 'Unknown',
    tone: 'neutral',
    geometry: { kind: 'unavailable' },
  },
];

function SelectableWaterfall({
  items,
  end = 1200,
}: {
  readonly items: ReadonlyArray<WaterfallItem>;
  readonly end?: number;
}): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = items.find((item) => item.id === selectedId);

  return (
    <Stack>
      <Panel isPadded={false}>
        <Waterfall
          items={items}
          start={0}
          end={end}
          label="Example operation timing"
          rowLabel="Operation"
          summaryLabel="Recorded result"
          emptyLabel="No timing records are available."
          selectedId={selectedId}
          onSelect={setSelectedId}
          formatOffset={(offset) => `${offset} ms`}
        />
      </Panel>
      {selected === undefined ? (
        <Muted>Select an operation to inspect its recorded result.</Muted>
      ) : (
        <Details
          items={[
            { label: 'Operation', value: selected.label },
            { label: 'Measured boundaries', value: selected.detail },
            { label: 'Result', value: selected.summary },
          ]}
        />
      )}
    </Stack>
  );
}

export const Recommended: Story = { render: () => <SelectableWaterfall items={intervals} /> };
export const PointsAndUnavailableTiming: Story = { render: () => <SelectableWaterfall items={partialTiming} /> };

export const UnavailableTiming: Story = {
  render: () => (
    <SelectableWaterfall items={partialTiming.filter((item) => item.geometry.kind === 'unavailable')} end={0} />
  ),
};

export const Empty: Story = { render: () => <SelectableWaterfall items={[]} end={0} /> };

export const ZeroDuration: Story = {
  render: () => (
    <SelectableWaterfall
      items={[
        {
          id: 'same-instant',
          label: 'Recorded at the same instant',
          detail: 'Both endpoints are zero',
          summary: '0 ms',
          tone: 'neutral',
          geometry: { kind: 'interval', start: 0, end: 0 },
        },
      ]}
      end={0}
    />
  ),
};

export const NarrowLongLabels: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <SelectableWaterfall
      items={[
        {
          id: 'long-operation',
          label: 'Prepare the complete collection of release references for review',
          detail: 'The full label and measured values remain available to keyboard and screen-reader users',
          summary: 'Awaiting a recorded endpoint',
          tone: 'neutral',
          geometry: { kind: 'point', at: 650, marker: 'hollow' },
        },
        ...intervals,
      ]}
    />
  ),
};

export const InvalidTiming: Story = {
  render: () => (
    <Stack>
      <SelectableWaterfall
        items={[
          {
            id: 'reversed',
            label: 'Reversed interval',
            detail: 'The end precedes the start',
            summary: 'Invalid timing',
            tone: 'neutral',
            geometry: { kind: 'interval', start: 350, end: 0 },
          },
        ]}
      />
      <SelectableWaterfall
        items={[
          {
            id: 'outside',
            label: 'Point outside the domain',
            detail: 'The event is later than the supplied domain',
            summary: 'Invalid timing',
            tone: 'neutral',
            geometry: { kind: 'point', at: 1500, marker: 'filled' },
          },
        ]}
      />
    </Stack>
  ),
};

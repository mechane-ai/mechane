import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { EventStrip } from './event-strip.tsx';
import type { EventStripItem, EventStripLane } from './event-strip.tsx';

const meta = {
  title: 'Charts/EventStrip',
  component: EventStrip,
  parameters: {
    docs: {
      description: {
        component:
          'Events along time in a few lanes: deploys, incidents, evaluation runs and alerts. An instant is a dot, an interval a bar, and events that overlap in a lane stack into rows. The application supplies lanes, events with their instants in milliseconds, the window and a time format that names its zone.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_START = Date.UTC(2026, 10, 20);
const day = [DAY_START, DAY_START + 24 * HOUR] as const;

function at(hours: number, minutes = 0): number {
  return DAY_START + hours * HOUR + minutes * MINUTE;
}

const lanes: ReadonlyArray<EventStripLane> = [
  { id: 'deploys', label: 'Deploys' },
  { id: 'incidents', label: 'Incidents', tone: 'negative' },
  { id: 'evals', label: 'Evaluation runs' },
  { id: 'alerts', label: 'Alerts' },
];

const events: ReadonlyArray<EventStripItem> = [
  { id: 'd1', laneId: 'deploys', label: 'api 4.12.0', start: at(2, 10) },
  { id: 'd2', laneId: 'deploys', label: 'api 4.12.1', start: at(9, 45), detail: 'Hotfix for the tokenizer cache' },
  { id: 'd3', laneId: 'deploys', label: 'worker 2.3.0', start: at(9, 52) },
  { id: 'd4', laneId: 'deploys', label: 'api 4.13.0', start: at(17, 30) },
  { id: 'i1', laneId: 'incidents', label: 'Elevated 5xx', start: at(8, 20), end: at(9, 58), detail: 'Severity 2' },
  { id: 'i2', laneId: 'incidents', label: 'Queue backlog', start: at(18, 5), end: at(19, 40) },
  { id: 'e1', laneId: 'evals', label: 'Nightly suite', start: at(0, 30), end: at(5, 15) },
  { id: 'e2', laneId: 'evals', label: 'Safety sweep', start: at(3), end: at(7, 30) },
  { id: 'e3', laneId: 'evals', label: 'Regression check', start: at(10, 30), end: at(12) },
  { id: 'e4', laneId: 'evals', label: 'Long-context eval', start: at(13), end: at(21, 30) },
  { id: 'e5', laneId: 'evals', label: 'Canary eval', start: at(17, 45), end: at(18, 30), tone: 'negative' },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `a${index}`,
    laneId: 'alerts',
    label: index % 3 === 0 ? 'p99 latency above 800 ms' : 'Error budget burn',
    start: at(8, 25 + index * 9 + (index % 2) * 2),
  })),
  { id: 'a9', laneId: 'alerts', label: 'Disk above 90%', start: at(22, 10) },
];

const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' } as const;

export const OperationsDay: Story = {
  render: () => (
    <EventStrip
      title="Production on 20 November"
      description="Synthetic operations log. Overlapping evaluation runs stack into rows; dashed rules are release cuts."
      locale="en-US"
      lanes={lanes}
      events={events}
      domain={day}
      timeFormat={clock}
      markers={[
        { id: 'cut', label: 'Release cut', at: at(16) },
        { id: 'freeze', label: 'Freeze', at: at(6) },
      ]}
      source="Synthetic deploy and paging logs"
    />
  ),
};

const LAUNCH = at(6);

const runs: ReadonlyArray<EventStripItem> = Array.from({ length: 12 }, (_, index) => ({
  id: `run-${index}`,
  laneId: index % 3 === 0 ? 'baseline' : 'candidate',
  label: `Seed ${index}`,
  start: LAUNCH + index * 50 * MINUTE,
  end: LAUNCH + index * 50 * MINUTE + (90 + (index % 4) * 25) * MINUTE,
  tone: index === 7 ? ('negative' as const) : undefined,
  detail: index === 7 ? 'Diverged at step 41k' : undefined,
}));

function elapsed(timestamp: number): string {
  return `T+${((timestamp - LAUNCH) / HOUR).toFixed(1)} h`;
}

function RunsWithSelection() {
  const [selected, setSelected] = useState<string | null>('run-7');

  return (
    <div>
      <EventStrip
        title="Training runs since launch"
        description="Synthetic sweep. Times are hours since launch; the axis still falls on the UTC clock."
        locale="en-US"
        lanes={[
          { id: 'baseline', label: 'Baseline' },
          { id: 'candidate', label: 'Candidate' },
        ]}
        events={runs}
        domain={[LAUNCH, LAUNCH + 13 * HOUR]}
        timeFormat={elapsed}
        timeZone="UTC"
        selected={selected}
        onSelectedChange={(id) => setSelected(id)}
      />
      <p>{`Selected: ${selected ?? 'none'}`}</p>
    </div>
  );
}

export const SelectableRuns: Story = { render: () => <RunsWithSelection /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <EventStrip
        title="Loading"
        locale="en-US"
        status="loading"
        lanes={[]}
        events={[]}
        domain={day}
        timeFormat={clock}
      />
      <EventStrip title="Empty" locale="en-US" lanes={lanes} events={[]} domain={day} timeFormat={clock} />
      <EventStrip
        title="Partial"
        locale="en-US"
        coverage={{ shown: 4, total: 380, unit: 'alerts' }}
        lanes={lanes.slice(3)}
        events={events.filter((event) => event.laneId === 'alerts').slice(0, 4)}
        domain={day}
        timeFormat={clock}
      />
      <EventStrip
        title="Invalid"
        locale="en-US"
        lanes={lanes.slice(1, 2)}
        events={[{ id: 'bad', laneId: 'incidents', label: 'Outage', start: at(10), end: at(9) }]}
        domain={day}
        timeFormat={clock}
      />
    </ChartGrid>
  ),
};

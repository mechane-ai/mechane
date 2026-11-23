import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SmallMultiplesPanel } from '../../../charts/src/cartesian/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { BudgetBoard } from './budget-board.tsx';
import type { BudgetGroup } from './budget-board.tsx';
import { IncidentTimeline } from './incident-timeline.tsx';
import type { OperationEvent } from './incident-timeline.tsx';
import { ServiceHealth } from './service-health.tsx';
import type { ServiceIndicator } from './service-health.tsx';

const meta = {
  title: 'Kits/Operations',
  component: ServiceHealth,
  subcomponents: { BudgetBoard, IncidentTimeline },
  parameters: {
    docs: {
      description: {
        component:
          'Components a team uses to show the health of a running service: ServiceHealth gives one service at a glance, BudgetBoard holds objectives and budgets against their targets, and IncidentTimeline lays deploys, alerts and incidents over the same time range as the charts. The application judges every state and supplies every value; the stories use synthetic data for an inference API.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const MINUTE = 60_000;
const START = Date.UTC(2026, 10, 20, 8);
const STEP = 5 * MINUTE;
const POINTS = 73;
const END = START + (POINTS - 1) * STEP;
const INCIDENT_START = 26;
const INCIDENT_END = 41;
const DEPLOY_AT = 25;
const HOTFIX_AT = 40;

const stamps = Array.from({ length: POINTS }, (_, index) => START + index * STEP);

/** A smooth hump that is 1 halfway between `from` and `to` and 0 outside. */
function bump(index: number, from: number, to: number): number {
  return index < from || index > to ? 0 : Math.sin((Math.PI * (index - from)) / (to - from));
}

function wave(index: number, period: number): number {
  return Math.sin((2 * Math.PI * index) / period);
}

const measures = {
  rate: stamps.map((_, index) =>
    Math.round(420 + 55 * wave(index, POINTS) - 190 * bump(index, INCIDENT_START, INCIDENT_END)),
  ),
  p50: stamps.map((_, index) => Math.round(96 + 7 * wave(index, 24) + 38 * bump(index, INCIDENT_START, INCIDENT_END))),
  p95: stamps.map((_, index) =>
    Math.round(262 + 22 * wave(index, 24) + 430 * bump(index, INCIDENT_START, INCIDENT_END)),
  ),
  errors: stamps.map(
    (_, index) =>
      Math.round((0.16 + 0.03 * wave(index, 18) + 2.6 * bump(index, INCIDENT_START, INCIDENT_END)) * 100) / 100,
  ),
  queue: stamps.map((_, index) =>
    Math.round(38 + 9 * wave(index, 30) + 880 * bump(index, INCIDENT_START, INCIDENT_END + 8)),
  ),
};

function points(values: ReadonlyArray<number>, from = 0) {
  return values.slice(from).map((value, index) => ({ timestamp: stamps[from + index] ?? START, value }));
}

function domainOf(values: ReadonlyArray<number>): readonly [number, number] {
  return [Math.floor(Math.min(...values)), Math.ceil(Math.max(...values))];
}

const TREND_POINTS = 24;
const trendFrom = POINTS - TREND_POINTS;

const count = { maximumFractionDigits: 0 } as const;
const milliseconds = { style: 'unit', unit: 'millisecond', maximumFractionDigits: 0 } as const;
const percent = { style: 'unit', unit: 'percent', maximumFractionDigits: 2 } as const;
const signedPercent = { style: 'percent', signDisplay: 'always', maximumFractionDigits: 1 } as const;
const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' } as const;

function trend(values: ReadonlyArray<number>, unit: string) {
  return { points: points(values, trendFrom), valueDomain: domainOf(values.slice(trendFrom)), unit };
}

const indicators: ReadonlyArray<ServiceIndicator> = [
  {
    id: 'rate',
    label: 'Requests per second',
    value: measures.rate.at(-1) ?? null,
    format: count,
    change: { value: 0.031, format: signedPercent, label: 'vs the previous hour' },
    trend: trend(measures.rate, 'requests per second'),
  },
  {
    id: 'p95',
    label: 'p95 latency',
    value: measures.p95.at(-1) ?? null,
    format: milliseconds,
    target: { value: 300, label: 'Objective' },
    trend: trend(measures.p95, 'milliseconds'),
  },
  {
    id: 'errors',
    label: 'Error rate',
    value: measures.errors.at(-1) ?? null,
    format: percent,
    target: { value: 0.5, label: 'Objective' },
    trend: trend(measures.errors, 'percent'),
  },
  {
    id: 'queue',
    label: 'Queue depth',
    value: measures.queue.at(-1) ?? null,
    format: count,
    change: { value: -0.12, format: signedPercent, label: 'vs the previous hour' },
    trend: trend(measures.queue, 'jobs'),
  },
];

const events: ReadonlyArray<OperationEvent> = [
  { id: 'deploy-1', kind: 'deploy', label: 'api 4.12.0', start: stamps[8] ?? START, detail: 'Tokenizer cache change' },
  {
    id: 'deploy-2',
    kind: 'deploy',
    label: 'api 4.13.0',
    start: stamps[DEPLOY_AT] ?? START,
    detail: 'New batching policy',
  },
  {
    id: 'deploy-3',
    kind: 'deploy',
    label: 'api 4.13.1',
    start: stamps[HOTFIX_AT] ?? START,
    detail: 'Revert of the batching policy',
  },
  {
    id: 'incident-1',
    kind: 'incident',
    label: 'Elevated 5xx',
    start: stamps[INCIDENT_START] ?? START,
    end: stamps[INCIDENT_END] ?? END,
    detail: 'Severity 2. Mitigated by the revert.',
  },
  ...[27, 28, 30, 33].map((index) => ({
    id: `alert-${index}`,
    kind: 'alert' as const,
    label: index % 2 === 0 ? 'p95 latency above 300 ms' : 'Error budget burn',
    start: stamps[index] ?? START,
  })),
];

const markers = events
  .filter((event) => event.kind === 'deploy' && event.start > START + STEP * 20)
  .map((event) => ({ kind: 'event' as const, id: event.id, timestamp: event.start, label: event.label }));

const charts: ReadonlyArray<SmallMultiplesPanel> = [
  {
    id: 'rate',
    title: 'Requests per second',
    series: [{ id: 'rate', label: 'Requests', points: points(measures.rate) }],
    valueFormat: count,
    markers,
  },
  {
    id: 'latency',
    title: 'Latency',
    series: [
      { id: 'p50', label: 'p50', points: points(measures.p50) },
      { id: 'p95', label: 'p95', points: points(measures.p95) },
    ],
    valueFormat: milliseconds,
  },
  {
    id: 'errors',
    title: 'Error rate',
    series: [{ id: 'errors', label: 'Errors', points: points(measures.errors) }],
    valueFormat: percent,
  },
  {
    id: 'queue',
    title: 'Queue depth',
    series: [{ id: 'queue', label: 'Waiting jobs', points: points(measures.queue) }],
    valueFormat: count,
  },
];

function ranges(limit: number, top: number) {
  return [
    { upTo: limit, label: 'Within objective' },
    { upTo: top, label: 'Over objective' },
  ];
}

const groups: ReadonlyArray<BudgetGroup> = [
  {
    id: 'latency',
    title: 'Latency objectives',
    description: 'Latency over the six hours shown. Lower is better.',
    value: { label: 'Latency (ms)', domain: [0, 600], format: milliseconds },
    rows: [
      {
        id: 'p50',
        label: 'p50 latency',
        value: 104,
        target: 150,
        ranges: ranges(150, 600),
        state: 'Within budget',
        tone: 'positive',
      },
      {
        id: 'p95-objective',
        label: 'p95 latency',
        value: 342,
        target: 300,
        ranges: ranges(300, 600),
        state: 'Over objective',
        tone: 'warning',
        detail: 'Above 300 ms for about an hour of the six shown.',
      },
    ],
  },
  {
    id: 'errors',
    title: 'Error objectives',
    description: 'Share of requests that failed over the six hours shown.',
    value: { label: 'Failed requests (%)', domain: [0, 1], format: percent },
    rows: [
      {
        id: 'error-rate',
        label: 'Error rate',
        value: 0.42,
        target: 0.5,
        ranges: ranges(0.5, 1),
        state: 'Within budget',
        tone: 'positive',
      },
    ],
  },
  {
    id: 'budget',
    title: 'Error budget',
    description: 'How much of each budget the service has spent.',
    value: { label: 'Budget spent (%)', domain: [0, 100], format: percent },
    rows: [
      {
        id: 'budget-30d',
        label: '30-day budget',
        value: 69,
        target: 100,
        ranges: [
          { upTo: 50, label: 'Comfortable' },
          { upTo: 80, label: 'Watch' },
          { upTo: 100, label: 'At risk' },
        ],
        state: 'Within budget',
        tone: 'positive',
        detail: '31% left; the incident spent 22 points.',
      },
      {
        id: 'budget-1h',
        label: '1-hour budget',
        value: 100,
        target: 100,
        ranges: [
          { upTo: 50, label: 'Comfortable' },
          { upTo: 80, label: 'Watch' },
          { upTo: 100, label: 'At risk' },
        ],
        state: 'Budget spent',
        tone: 'negative',
        detail: 'Spent at 10:45; refills as the hour rolls.',
      },
    ],
  },
];

const time = { locale: 'en-US', timestampUnit: 'milliseconds', timeFormat: clock } as const;

const styles = stylex.create({
  page: {
    display: 'grid',
    gap: spacing.xxl,
    maxWidth: 1040,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  states: {
    display: 'grid',
    gap: spacing.xxl,
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    alignItems: 'start',
  },
  heading: { margin: 0, fontSize: typography.sectionSize, lineHeight: typography.sectionLineHeight },
});

function PageSection({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <section {...stylex.props(styles.page)}>
      <h2 {...stylex.props(styles.heading)}>{title}</h2>
      {children}
    </section>
  );
}

export const ServiceHealthStory: Story = {
  name: 'ServiceHealth',
  render: () => (
    <ServiceHealth
      service={{
        id: 'inference',
        label: 'Inference API',
        state: 'healthy',
        stateDetail: 'Recovered at 11:25 UTC after a revert. Watching the queue drain.',
      }}
      indicators={indicators}
      charts={charts}
      {...time}
    />
  ),
};

function SelectableBudgets(): ReactNode {
  const [selected, setSelected] = useState<string | null>('p95-objective');

  return <BudgetBoard groups={groups} locale="en-US" selected={selected} onSelectedChange={(id) => setSelected(id)} />;
}

export const BudgetBoardStory: Story = { name: 'BudgetBoard', render: () => <SelectableBudgets /> };

function SelectableEvents(): ReactNode {
  const [selected, setSelected] = useState<string | null>('incident-1');

  return (
    <div {...stylex.props(styles.page)}>
      <IncidentTimeline
        title="Deploys, alerts and incidents"
        description="Synthetic log for the same six hours as the charts."
        locale="en-US"
        events={events}
        window={[START, END]}
        timeFormat={clock}
        selected={selected}
        onSelectedChange={(id) => setSelected(id)}
      />
      <p>{`Selected: ${selected ?? 'none'}`}</p>
    </div>
  );
}

export const IncidentTimelineStory: Story = { name: 'IncidentTimeline', render: () => <SelectableEvents /> };

function ServicePage(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div {...stylex.props(styles.page)}>
      <ServiceHealth
        service={{
          id: 'inference',
          label: 'Inference API',
          state: 'healthy',
          stateDetail: 'Recovered at 11:25 UTC after a revert. The queue has drained.',
        }}
        indicators={indicators}
        charts={charts}
        {...time}
      />
      <PageSection title="Events">
        <IncidentTimeline
          title="Deploys, alerts and incidents"
          locale="en-US"
          events={events}
          window={[START, END]}
          timeFormat={clock}
          selected={selected}
          onSelectedChange={(id) => setSelected(id)}
        />
      </PageSection>
      <PageSection title="Objectives and budgets">
        <BudgetBoard groups={groups} locale="en-US" />
      </PageSection>
    </div>
  );
}

export const Service: Story = { render: () => <ServicePage /> };

const noTrend = indicators.map(({ trend: _trend, ...indicator }) => indicator).slice(0, 2);

export const States: Story = {
  render: () => (
    <div {...stylex.props(styles.states)}>
      {(['healthy', 'degraded', 'down', 'unknown'] as const).map((state) => (
        <ServiceHealth
          key={state}
          service={{ id: state, label: `Service, ${state}`, state, stateDetail: 'The application writes why.' }}
          indicators={noTrend}
          charts={[]}
          {...time}
        />
      ))}
      <ServiceHealth
        service={{ id: 'loading', label: 'Loading', state: 'unknown' }}
        indicators={indicators.slice(0, 2)}
        charts={charts.slice(0, 1)}
        status="loading"
        {...time}
      />
      <ServiceHealth
        service={{ id: 'invalid', label: 'Invalid input', state: 'unknown' }}
        indicators={[...indicators.slice(0, 1), ...indicators.slice(0, 1)]}
        charts={[]}
        {...time}
      />
      <BudgetBoard groups={[]} locale="en-US" />
      <BudgetBoard groups={groups.slice(0, 1)} locale="en-US" status="loading" />
      <IncidentTimeline title="Empty" locale="en-US" events={[]} window={[START, END]} timeFormat={clock} />
      <IncidentTimeline
        title="Partial"
        locale="en-US"
        coverage={{ shown: 4, total: 380, unit: 'alerts' }}
        events={events.filter((event) => event.kind === 'alert')}
        window={[START, END]}
        timeFormat={clock}
      />
      <IncidentTimeline
        title="Loading"
        locale="en-US"
        status="loading"
        events={[]}
        window={[START, END]}
        timeFormat={clock}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel, Stack } from '../../../core/src/index.ts';
import type { TimeSeriesBand, TimeSeriesCrossing } from './time-series-bands.ts';
import type { TimeSeries, TimeSeriesMarker } from './time-series-data.ts';
import { LineChart } from './time-series.tsx';

const meta = {
  title: 'Charts/Ranges and events',
  component: LineChart,
  parameters: {
    docs: {
      description: {
        component:
          'LineChart accepts bands: a shaded range between supplied lower and upper values with an optional center line, such as low, expected and high outcomes. Event markers name an instant that may fall between observations and label it on the plot. A crossing marks where a drawn line first reaches a value, interpolated exactly as the line is drawn; when the line never reaches it, the chart says so. The application computes every bound and chooses the events. Inspection lists the center, the range and any event nearest the inspected observation. Use these for projections and plans; recorded measurements with gaps keep ordinary series.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const YEAR_SECONDS = 31_556_952;
const START_YEAR = 2026;
const years = Array.from({ length: 41 }, (_, index) => START_YEAR + index);

function yearTimestamp(year: number): number {
  return (year - 1970) * YEAR_SECONDS;
}

const OPENING_BALANCE = 150;
const YEARLY_CONTRIBUTION = 30;
const YEARLY_WITHDRAWAL = 110;
const CONTRIBUTING_YEARS = 19;

/** Grows a balance with yearly additions, or shrinks it with yearly withdrawals when the amount is negative. */
function compound({
  opening,
  rate,
  years: elapsed,
  yearly,
}: {
  readonly opening: number;
  readonly rate: number;
  readonly years: number;
  readonly yearly: number;
}): number {
  const growth = (1 + rate) ** elapsed;

  return opening * growth + (yearly * (growth - 1)) / rate;
}

function balance({ year, rate }: { readonly year: number; readonly rate: number }): number {
  const elapsed = year - START_YEAR;
  const contributing = Math.min(elapsed, CONTRIBUTING_YEARS);
  const drawing = Math.max(0, elapsed - CONTRIBUTING_YEARS);
  const saved = compound({ opening: OPENING_BALANCE, rate, years: contributing, yearly: YEARLY_CONTRIBUTION });

  return Math.round(compound({ opening: saved, rate, years: drawing, yearly: -YEARLY_WITHDRAWAL }));
}

const projection: TimeSeriesBand = {
  id: 'balance',
  label: 'Expected balance',
  rangeLabel: 'Low to high returns',
  tone: 'series1',
  points: years.map((year) => ({
    timestamp: yearTimestamp(year),
    lower: balance({ year, rate: 0.02 }),
    center: balance({ year, rate: 0.045 }),
    upper: balance({ year, rate: 0.07 }),
  })),
};

const events: ReadonlyArray<TimeSeriesMarker> = [
  { id: 'change', kind: 'event', timestamp: yearTimestamp(2045) + YEAR_SECONDS / 2, label: 'Contributions stop' },
];

const crossings: ReadonlyArray<TimeSeriesCrossing> = [
  { id: 'low-depleted', seriesId: 'low-path', value: 0, label: 'Low path reaches zero', direction: 'falling' },
  { id: 'expected-depleted', seriesId: 'balance', value: 0, label: 'Expected reaches zero', direction: 'falling' },
];

const lowPath: TimeSeries = {
  id: 'low-path',
  label: 'Low returns path',
  tone: 'negative',
  points: years.map((year) => ({ timestamp: yearTimestamp(year), value: balance({ year, rate: 0.02 }) })),
};

const exactDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const compactDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatYear(timestamp: number): string {
  return String(Math.floor(timestamp / YEAR_SECONDS) + 1970);
}

function formatThousands(value: number): string {
  return exactDollars.format(value * 1000);
}

function formatCompact(value: number): string {
  return compactDollars.format(value * 1000);
}

export const ProjectionRange: Story = {
  render: () => (
    <Panel>
      <LineChart
        title="Projected balance"
        description="Synthetic projection in US dollars. The band spans 2% to 7% yearly returns around a 4.5% expectation. Contributions stop in mid-2045 and withdrawals begin."
        series={[lowPath]}
        bands={[projection]}
        markers={events}
        crossings={crossings}
        timestampUnit="seconds"
        formatTimestamp={formatYear}
        formatValue={formatThousands}
        formatTick={formatCompact}
        height={280}
      />
    </Panel>
  ),
};

const quarters = [0, 90, 181, 273, 365].map((day) => day * 86_400);

const capacity: TimeSeriesBand = {
  id: 'capacity',
  label: 'Planned capacity',
  rangeLabel: 'Committed to burst',
  points: quarters.map((timestamp, index) => ({
    timestamp,
    lower: [40, 44, null, 52, 56][index] ?? null,
    center: [46, 50, 54, 58, 63][index] ?? null,
    upper: [52, 57, null, 66, 72][index] ?? null,
  })),
};

function formatDay(timestamp: number): string {
  return `Day ${Math.round(timestamp / 86_400)}`;
}

function formatNodes(value: number): string {
  return `${value} nodes`;
}

export const GapsAndUnreached: Story = {
  render: () => (
    <Stack>
      <Panel>
        <LineChart
          title="Capacity plan"
          description="Synthetic plan. The burst bound is unknown for the third quarter, so the range shows a gap while the center continues. The plan never reaches the 80-node limit."
          series={[]}
          bands={[capacity]}
          markers={[{ id: 'review', kind: 'event', timestamp: 200 * 86_400, label: 'Budget review' }]}
          crossings={[{ id: 'limit', seriesId: 'capacity', value: 80, label: 'Reaches the 80-node limit' }]}
          timestampUnit="seconds"
          formatTimestamp={formatDay}
          formatValue={formatNodes}
        />
      </Panel>
    </Stack>
  ),
};

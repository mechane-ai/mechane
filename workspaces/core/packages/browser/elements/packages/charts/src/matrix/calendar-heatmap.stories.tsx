import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../../core/src/index.ts';
import { CalendarHeatmap } from './calendar-heatmap.tsx';
import type { CalendarDay } from './calendar-heatmap.tsx';
import type { MatrixCellRange } from './matrix-types.ts';

const meta = {
  title: 'Charts/CalendarHeatmap',
  component: CalendarHeatmap,
  parameters: {
    docs: {
      description: {
        component:
          'One value per civil date with weeks as columns, weekdays as rows and the months named above, as lightness of one hue. Use it for daily operations counts such as evaluation runs, incidents or training jobs. The application supplies YYYY-MM-DD dates, the range and the week start; a day in the range with no value is hollow.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const DAYS = 181;
const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 0, 1);
const WEEKEND: ReadonlySet<number> = new Set([0, 6]);

/** 2026-01-01 was a Thursday. Weekends run fewer jobs; every 23rd day the scheduler was down and recorded nothing. */
const runs: ReadonlyArray<CalendarDay> = Array.from({ length: DAYS }, (_, offset) => {
  const weekday = (offset + 4) % 7;
  const isWeekend = WEEKEND.has(weekday);
  const value = isWeekend ? 3 + (offset % 4) : Math.round(18 + 9 * Math.sin(offset / 9) + (offset % 5));

  return {
    date: new Date(START + offset * DAY_MS).toISOString().slice(0, 10),
    value: offset % 23 === 22 ? null : value,
  };
});

const runFormat = { maximumFractionDigits: 0 } as const;

export const Default: Story = {
  render: () => (
    <CalendarHeatmap
      title="Evaluation runs per day"
      description="Synthetic scheduler log for the first half of 2026. Hollow days had no record."
      locale="en-US"
      days={runs}
      range={{ from: '2026-01-01', to: '2026-06-30' }}
      weekStartsOn="monday"
      valueLabel="Evaluation runs"
      valueFormat={runFormat}
      source="Synthetic scheduler log"
    />
  ),
};

function Pick(): ReactNode {
  const [selected, setSelected] = useState<string | null>('2026-03-17');
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>(null);

  return (
    <Stack>
      <CalendarHeatmap
        title="Pick a day"
        description="Weeks start on Sunday. Select a day to load its runs, or mark a block of days to copy."
        locale="en-US"
        days={runs.slice(59, 120)}
        range={{ from: '2026-03-01', to: '2026-04-30' }}
        weekStartsOn="sunday"
        valueLabel="Evaluation runs"
        valueFormat={runFormat}
        selected={selected}
        onSelectedChange={setSelected}
        cellRange={cellRange}
        onCellRangeChange={setCellRange}
      />
      <p>Selected day: {selected ?? 'none'}</p>
    </Stack>
  );
}

export const Interactive: Story = { render: () => <Pick /> };

const week = { from: '2026-05-04', to: '2026-05-10' };

export const States: Story = {
  render: () => (
    <Stack>
      <CalendarHeatmap
        title="Incidents"
        locale="en-US"
        days={[]}
        range={week}
        weekStartsOn="monday"
        valueLabel="Incidents"
        valueFormat={runFormat}
        status="loading"
      />
      <CalendarHeatmap
        title="Incidents"
        locale="en-US"
        days={[]}
        range={week}
        weekStartsOn="monday"
        valueLabel="Incidents"
        valueFormat={runFormat}
        emptyLabel="No incidents were recorded in this period."
      />
      <CalendarHeatmap
        title="Incidents, one region"
        locale="en-US"
        days={runs.slice(123, 130)}
        range={week}
        weekStartsOn="monday"
        valueLabel="Incidents"
        valueFormat={runFormat}
        coverage={{ shown: 1, total: 4, unit: 'regions' }}
      />
      <CalendarHeatmap
        title="Incidents, misdated"
        description="A day outside the supplied range cannot be placed, so the chart refuses it."
        locale="en-US"
        days={[{ date: '2026-05-11', value: 2 }]}
        range={week}
        weekStartsOn="monday"
        valueLabel="Incidents"
        valueFormat={runFormat}
      />
    </Stack>
  ),
};

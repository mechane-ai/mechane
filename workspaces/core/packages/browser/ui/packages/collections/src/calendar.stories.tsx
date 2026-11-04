import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Stack, Text } from '../../core/src/index.ts';
import { Calendar } from './calendar.tsx';
import type { CalendarDate, CalendarRange } from './calendar.tsx';
import { DateRangePicker } from './date-range-picker.tsx';

const today: CalendarDate = { year: 2026, month: 11, day: 3 };
const environment = { locale: 'en-US', timeZone: 'America/Los_Angeles', today, initialMonth: today };

function RangeExample() {
  const [value, setValue] = useState<CalendarRange>();

  return (
    <Stack>
      <DateRangePicker
        {...environment}
        label="Select dates"
        value={value}
        onValueChange={setValue}
        formatValue={(range) =>
          `${range.from.month}/${range.from.day} – ${range.to === undefined ? 'Choose end' : `${range.to.month}/${range.to.day}`}`
        }
        presets={[
          {
            id: 'week',
            label: 'This week',
            value: { from: { year: 2026, month: 11, day: 2 }, to: { year: 2026, month: 11, day: 8 } },
          },
        ]}
      />
      <Text>
        Calendar dates retain their year, month and day across time zones. The application converts the chosen range to
        API timestamps.
      </Text>
    </Stack>
  );
}

function SingleExample() {
  const [value, setValue] = useState<CalendarDate | undefined>(today);

  return <Calendar {...environment} label="Choose a date" mode="single" value={value} onValueChange={setValue} />;
}

const meta = {
  title: 'Collections/Calendar',
  component: Calendar,
  subcomponents: { DateRangePicker },
  parameters: {
    docs: {
      description: {
        component:
          'DayPicker owns calendar keyboard navigation. Supply civil dates, locale, time zone, today and initial month explicitly. Partial ranges remain partial. Choose Calendar for an inline range and DateRangePicker for the same range in a labeled popup. The application owns selected dates and query boundaries. Presets are supplied values, never hidden relative-time calculations.',
      },
    },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj;
export const Single: Story = { render: () => <SingleExample /> };
export const RangePicker: Story = { render: () => <RangeExample /> };

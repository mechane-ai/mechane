import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Row, Stack, Text } from '../../../core/src/index.ts';
import { Calendar } from './calendar.tsx';
import type { CalendarDate } from './calendar.tsx';
import { dateInput, formatDate, formatMonth } from './civil.ts';
import type { CalendarMonth, DateRange, MonthRange } from './civil.ts';
import { DatePicker } from './date-picker.tsx';
import { DateRangePicker } from './date-range-picker.tsx';
import { MonthPicker } from './month-picker.tsx';
import { MonthRangePicker } from './month-range-picker.tsx';

const today: CalendarDate = { year: 2026, month: 11, day: 3 };
const environment = { locale: 'en-US', timeZone: 'America/Los_Angeles', today, initialMonth: today };
const initialRange = { from: { year: 2026, month: 10, day: 13 }, to: { year: 2026, month: 11, day: 2 } };
const initialMonths = { from: { year: 2026, month: 8 }, to: { year: 2026, month: 11 } };

function RangeExample() {
  const [value, setValue] = useState<DateRange | undefined>(initialRange);

  return (
    <Stack>
      <DateRangePicker
        {...environment}
        label="Date range"
        value={value}
        onValueChange={setValue}
        minimum={{ year: 2024, month: 1, day: 1 }}
        maximum={today}
        validateRange={(range) =>
          (Date.parse(dateInput(range.to)) - Date.parse(dateInput(range.from))) / 86_400_000 >= 31
            ? 'Select at most 31 calendar days.'
            : undefined
        }
        presets={[
          {
            id: 'week',
            label: 'Last 7 days',
            value: { from: { year: 2026, month: 10, day: 27 }, to: { year: 2026, month: 11, day: 2 } },
          },
          {
            id: 'month',
            label: 'October',
            value: { from: { year: 2026, month: 10, day: 1 }, to: { year: 2026, month: 10, day: 31 } },
          },
        ]}
      />
      <Text aria-live="polite">
        {value === undefined
          ? 'No committed dates'
          : `Committed: ${formatDate(value.from, environment.locale)} – ${formatDate(value.to, environment.locale)}`}
      </Text>
    </Stack>
  );
}

function SingleExample() {
  const [value, setValue] = useState<CalendarDate | undefined>(today);

  return <Calendar {...environment} label="Choose a date" mode="single" value={value} onValueChange={setValue} />;
}

function DateExample() {
  const [value, setValue] = useState<CalendarDate | undefined>(today);

  return <DatePicker {...environment} label="Date" value={value} onValueChange={setValue} />;
}

function MonthExample() {
  const [value, setValue] = useState<CalendarMonth | undefined>(today);

  return (
    <Stack>
      <MonthPicker {...environment} label="Billing month" value={value} onValueChange={setValue} maximum={today} />
      <Text aria-live="polite">
        {value === undefined ? 'No committed month' : `Committed: ${formatMonth(value, environment.locale)}`}
      </Text>
    </Stack>
  );
}

function MonthRangeExample() {
  const [value, setValue] = useState<MonthRange | undefined>(initialMonths);

  return (
    <Stack>
      <MonthRangePicker
        {...environment}
        label="Billing period"
        value={value}
        onValueChange={setValue}
        maximum={today}
        validateRange={(range) =>
          (range.to.year - range.from.year) * 12 + range.to.month - range.from.month >= 12
            ? 'Select at most 12 billing months.'
            : undefined
        }
        presets={[{ id: 'year', label: 'Year to date', value: { from: { year: 2026, month: 1 }, to: today } }]}
      />
      <Text aria-live="polite">
        {value === undefined
          ? 'No committed period'
          : `Committed: ${formatMonth(value.from, environment.locale)} – ${formatMonth(value.to, environment.locale)}`}
      </Text>
    </Stack>
  );
}

function CompactExample() {
  const [date, setDate] = useState<CalendarDate | undefined>(today);
  const [month, setMonth] = useState<CalendarMonth | undefined>(today);

  return (
    <Row>
      <DatePicker
        {...environment}
        label="Date"
        density="compact"
        isClearable={false}
        value={date}
        onValueChange={setDate}
      />
      <MonthPicker
        {...environment}
        label="Month"
        density="compact"
        isClearable={false}
        value={month}
        onValueChange={setMonth}
      />
    </Row>
  );
}

const meta = {
  title: 'Forms/Dates',
  component: Calendar,
  subcomponents: { DatePicker, DateRangePicker, MonthPicker, MonthRangePicker },
  parameters: {
    docs: {
      description: {
        component:
          'Choose DatePicker for one civil date, DateRangePicker for a day interval, MonthPicker for one billing month, and MonthRangePicker for a monthly trend. Calendar is the inline single/range primitive. Pickers keep a draft while open: Apply commits once, presets commit their complete range immediately, and Cancel, Escape or outside dismissal discard edits. Partial CalendarRange values never reach a picker commit callback; DateRange and MonthRange require both endpoints. Type a date or month in the labeled fields or use the calendar. Month keys move with arrows, Home/End and Page Up/Down. Supply locale, timeZone, today, initialMonth, bounds and preset values explicitly; the application converts inclusive civil endpoints to API intervals and owns authorization and range limits. validateRange returns an inline message and disables Apply; isClearable=false makes a required query period explicit. Density changes the trigger only; popup inputs and actions remain standard. No query or hidden current-time read occurs while editing.',
      },
    },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj;
export const Single: Story = { render: () => <SingleExample /> };
export const SinglePicker: Story = { render: () => <DateExample /> };
export const RangePicker: Story = { render: () => <RangeExample /> };
export const BillingMonth: Story = { render: () => <MonthExample /> };
export const BillingRange: Story = { render: () => <MonthRangeExample /> };
export const CompactPickers: Story = { render: () => <CompactExample /> };

export const NarrowRangePicker: Story = {
  ...RangePicker,
  globals: { viewport: { value: 'narrow', isRotated: false } },
};

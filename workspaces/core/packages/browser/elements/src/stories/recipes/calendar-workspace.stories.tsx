import type { EventMonthItem } from '@mechane-ai/elements/forms/dates';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CalendarWorkspace } from '../../../recipes/calendar-workspace.tsx';

const meta = {
  title: 'Recipes/Calendar Workspace',
  component: CalendarWorkspace,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CalendarWorkspace>;

export default meta;

const today = { year: 2026, month: 11, day: 25 };

const events = new Map<string, ReadonlyArray<EventMonthItem>>([
  ['2026-11-24', [{ id: 'library', label: 'Library pickup' }]],
  ['2026-11-25', [{ id: 'walk', label: 'Evening walk with the neighborhood garden volunteers' }]],
  ['2026-11-28', [{ id: 'market', label: 'Winter market' }]],
]);

function CalendarExample() {
  const [selected, select] = useState(today);

  return (
    <CalendarWorkspace
      label="Event dates"
      locale="en-US"
      timeZone="America/Los_Angeles"
      today={today}
      selected={selected}
      itemsByDate={events}
      onSelect={select}
    />
  );
}

export const Example: StoryObj = { render: () => <CalendarExample /> };

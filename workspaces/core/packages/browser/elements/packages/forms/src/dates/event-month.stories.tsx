import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EventMonth } from './event-month.tsx';
import type { EventMonthItem } from './event-month.tsx';

const today = { year: 2026, month: 11, day: 30 };

const items = new Map<string, ReadonlyArray<EventMonthItem>>([
  [
    '2026-11-30',
    [
      { id: '1', label: 'Morning appointment' },
      { id: '2', label: 'Lunch with a friend' },
      { id: '3', label: 'Community concert' },
    ],
  ],
  ['2026-12-01', [{ id: '4', label: 'Library pickup' }]],
]);

function Example({ hasEvents = true, isNarrow = false }: { hasEvents?: boolean; isNarrow?: boolean }) {
  const [selected, setSelected] = useState(today);

  return (
    <div style={{ inlineSize: isNarrow ? 360 : '100%', maxInlineSize: '100%' }}>
      <EventMonth
        label="Events"
        locale="en-US"
        timeZone="America/Los_Angeles"
        today={today}
        selected={selected}
        itemsByDate={hasEvents ? items : new Map()}
        onSelect={setSelected}
      />
    </div>
  );
}

const meta = { title: 'Forms/Event month', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const Empty: Story = { args: { hasEvents: false } };
export const Narrow: Story = { args: { isNarrow: true } };

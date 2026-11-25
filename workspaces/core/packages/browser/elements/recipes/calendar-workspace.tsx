import { Text } from '@mechane-ai/elements';
import { EventMonth, serializeCalendarDate } from '@mechane-ai/elements/forms/dates';
import type { EventMonthProps } from '@mechane-ai/elements/forms/dates';
import { PageLayout, PageSection } from '@mechane-ai/elements/layout';

/**
 * Keep a month grid flush with the workspace edges using PageSection's breakdown slot, then show the selected day's
 * full event names in an inset sibling section. The caller supplies the events and controls the selected civil date.
 */
export function CalendarWorkspace(calendar: EventMonthProps) {
  const date = serializeCalendarDate(calendar.selected);
  const selected = new Date(`${date}T00:00:00Z`);

  const month = new Intl.DateTimeFormat(calendar.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    selected,
  );

  const day = new Intl.DateTimeFormat(calendar.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(selected);

  const events = calendar.itemsByDate.get(date) ?? [];

  return (
    <PageLayout title="Calendar" showNavigation={false}>
      <PageSection title={month} breakdown={<EventMonth {...calendar} />} />
      <PageSection title={day}>
        {events.length === 0 ? (
          <Text tone="muted">No events on this day.</Text>
        ) : (
          events.map((event) => <Text key={event.id}>{event.label}</Text>)
        )}
      </PageSection>
    </PageLayout>
  );
}

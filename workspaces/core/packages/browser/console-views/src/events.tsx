import { Event } from '@mechane/protocol';
import type { EventPage } from '@mechane/protocol';
import { Badge, Divider, EmptyState, Identifier, Muted, Panel, Prose, Row, Stack } from '@mechane/ui';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { timeLabel } from './format.ts';

export function Activity({ page }: { readonly page: EventPage }): ReactNode {
  if (page.events.length === 0) {
    return (
      <Panel>
        <EmptyState title="No activity yet">
          Inbox messages, turns, and replies appear here as the mech works.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <Panel>
      <Stack>
        {page.events.toReversed().map((event) => (
          <Stack key={event.sequence} compact>
            <Row between>
              <Row>
                <Badge>{event.type.replaceAll('_', ' ')}</Badge>
                <Identifier>#{event.sequence}</Identifier>
              </Row>
              <Muted>{Schema.is(Event)(event) ? timeLabel(event.occurredAt) : 'Newer event format'}</Muted>
            </Row>
            {Schema.is(Event)(event) && <EventContent event={event} />}
            <Divider />
          </Stack>
        ))}
      </Stack>
    </Panel>
  );
}

function EventContent({ event }: { readonly event: Event }): ReactNode {
  if ('text' in event) {
    return <Prose>{event.text}</Prose>;
  }

  if ('reply' in event) {
    return <Prose>{event.reply}</Prose>;
  }

  if ('report' in event) {
    return <Prose>{event.report}</Prose>;
  }

  if ('reason' in event) {
    return <Muted>{event.reason}</Muted>;
  }

  if ('turnId' in event) {
    return <Identifier>{event.turnId}</Identifier>;
  }

  return null;
}

import { Badge, CopyValue, Divider, EmptyState, Identifier, Muted, Panel, Prose, Row, Stack } from '@mechane-ai/ui';
import { Conversation, Message } from '@mechane-ai/ui/ai';
import { Markdown } from '@mechane-ai/ui/content';
import { Event } from '@mechane/protocol';
import type { EventPage, ListedEvent } from '@mechane/protocol';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { preciseTimeLabel, timeLabel } from './format.ts';

export function Activity({
  page,
  chronological = false,
}: {
  readonly page: EventPage;
  readonly chronological?: boolean;
}): ReactNode {
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
      <Conversation.Root initialPosition="start" follow={false}>
        <Conversation.Viewport label={chronological ? 'Turn messages and events' : 'Recent messages and events'}>
          <Conversation.Content>
            {(chronological ? page.events : page.events.toReversed()).map((event) => (
              <Conversation.Item key={event.sequence} messageId={String(event.sequence)}>
                <EventItem event={event} />
              </Conversation.Item>
            ))}
          </Conversation.Content>
        </Conversation.Viewport>
      </Conversation.Root>
    </Panel>
  );
}

function EventItem({ event }: { readonly event: ListedEvent }): ReactNode {
  const known = Schema.is(Event)(event);

  const meta = (
    <Row>
      <Identifier>#{event.sequence}</Identifier>
      {known ? (
        <CopyValue label={`time of event ${event.sequence} in UTC`} value={preciseTimeLabel(event.occurredAt)}>
          {timeLabel(event.occurredAt)}
        </CopyValue>
      ) : (
        <Muted>Newer event format</Muted>
      )}
    </Row>
  );

  const isMessage = 'text' in event || 'reply' in event || 'report' in event;

  if (known && isMessage) {
    return (
      <Message author={eventLabel(event.type)} kind={'text' in event ? 'user' : 'assistant'} meta={meta}>
        <EventContent event={event} />
      </Message>
    );
  }

  return (
    <Stack compact>
      <Row between>
        <Badge>{eventLabel(event.type)}</Badge>
        {meta}
      </Row>
      {known && <EventContent event={event} />}
      <Divider />
    </Stack>
  );
}

function EventContent({ event }: { readonly event: Event }): ReactNode {
  if ('text' in event) {
    return <Prose>{event.text}</Prose>;
  }

  if ('reply' in event) {
    return <Markdown>{event.reply}</Markdown>;
  }

  if ('report' in event) {
    return <Markdown>{event.report}</Markdown>;
  }

  if ('reason' in event) {
    return <Muted>{event.reason}</Muted>;
  }

  if ('turnId' in event) {
    return <Identifier>{event.turnId}</Identifier>;
  }

  return null;
}

function eventLabel(type: string): string {
  switch (type) {
    case 'inbox_item.received':
      return 'Message received';
    case 'inbox_item.written':
      return 'Message saved';
    case 'turn.started':
      return 'Turn started';
    case 'turn.joined':
      return 'Message joined';
    case 'turn.canceled':
      return 'Cancellation requested';
    case 'turn.answered':
      return 'Reply';
    case 'turn.unanswered':
      return 'Turn ended';
    case 'drone.reported':
      return 'Drone report';
    default:
      return type.replaceAll(/[._]/g, ' ');
  }
}

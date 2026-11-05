import { CopyValue, Muted, Prose, Row, Stack, TextLink } from '@mechane-ai/elements';
import { Conversation, Message } from '@mechane-ai/elements/ai';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Event, EventType } from '@mechane/protocol';
import type { EventPage } from '@mechane/protocol';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { timeLabel } from './format.ts';
import { outcomeReason } from './turn-outcome.ts';

const conversationEvents: ReadonlySet<Event['type']> = new Set([
  EventType.InboxItemReceived,
  EventType.TurnAnswered,
  EventType.TurnUnanswered,
  EventType.MechForked,
  EventType.DroneReported,
]);

export function MechConversation({
  page,
  name,
  controls,
  inspect,
  sourceLink,
}: {
  readonly page: EventPage;
  readonly name: string;
  readonly controls: ReactNode;
  readonly inspect: (turnId: string) => ReactNode;
  readonly sourceLink: (mechId: string) => ReactNode;
}): ReactNode {
  const events = page.events.filter(Schema.is(Event));
  const messages = events.filter((event) => conversationEvents.has(event.type));

  return (
    <Conversation.Root>
      <Conversation.Viewport label={`${name} conversation`}>
        <Conversation.Content>
          {controls}
          {messages.length === 0 && (
            <EmptyState title="Start a conversation">
              Send a message below. This mech keeps the conversation as it works across its connected channels.
            </EmptyState>
          )}
          {messages.map((event) => (
            <Conversation.Item key={event.sequence} messageId={String(event.sequence)}>
              {event.type === EventType.InboxItemReceived && (
                <Message
                  author={event.source === undefined ? 'Workspace member' : 'Slack message'}
                  kind="user"
                  meta={timeLabel(event.occurredAt)}
                >
                  <Prose>{event.text}</Prose>
                  {event.source !== undefined && (
                    <TextLink
                      href={`https://app.slack.com/client/${encodeURIComponent(event.source.teamId)}/${encodeURIComponent(event.source.channelId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Slack channel ↗
                    </TextLink>
                  )}
                </Message>
              )}
              {event.type === EventType.TurnAnswered && (
                <Message
                  author={name}
                  meta={timeLabel(event.occurredAt)}
                  actions={
                    <>
                      {inspect(event.turnId)}
                      <CopyValue value={event.reply} label="reply">
                        Copy
                      </CopyValue>
                    </>
                  }
                >
                  <Markdown>{event.reply}</Markdown>
                </Message>
              )}
              {event.type === EventType.TurnUnanswered && (
                <Message author={name} kind="system" meta={timeLabel(event.occurredAt)} actions={inspect(event.turnId)}>
                  <Prose>{outcomeReason(event.reason)}</Prose>
                </Message>
              )}
              {event.type === EventType.DroneReported && (
                <Message author="Delegated work" kind="assistant" meta={timeLabel(event.occurredAt)}>
                  <Markdown>{event.report}</Markdown>
                </Message>
              )}
              {event.type === EventType.MechForked && (
                <Message
                  author="Conversation continued from another mech"
                  kind="system"
                  meta={timeLabel(event.occurredAt)}
                >
                  <Stack compact>
                    <Muted>
                      History was copied through event {event.forkedFrom.sequence}. Each mech continues independently
                      after this point.
                    </Muted>
                    <Row>{sourceLink(event.forkedFrom.mechId)}</Row>
                  </Stack>
                </Message>
              )}
            </Conversation.Item>
          ))}
        </Conversation.Content>
      </Conversation.Viewport>
      <Conversation.JumpToLatest />
    </Conversation.Root>
  );
}

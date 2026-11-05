import { CopyValue, Muted, Prose, Row, Stack } from '@mechane-ai/elements';
import { Conversation, Message, MessageAction, MessageBoundary } from '@mechane-ai/elements/ai';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Event, EventType } from '@mechane/protocol';
import type { EventPage } from '@mechane/protocol';
import { Schema } from 'effect';
import { MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConsoleTimestamp } from './record-time.tsx';
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
  avatar,
  controls,
  inspect,
  sourceLink,
}: {
  readonly page: EventPage;
  readonly name: string;
  readonly avatar?: ReactNode;
  readonly controls: ReactNode;
  readonly inspect: (turnId: string) => ReactNode;
  readonly sourceLink: (mechId: string) => ReactNode;
}): ReactNode {
  const events = page.events.filter(Schema.is(Event));
  const messages = events.filter((event) => conversationEvents.has(event.type));

  return (
    <Conversation.Root>
      <Conversation.Viewport label={`${name} conversation`} scrollRestorationId="conversation">
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
                  author={event.source === undefined ? 'Workspace member' : 'Slack'}
                  kind="user"
                  meta={<ConsoleTimestamp value={event.occurredAt} />}
                  avatar={
                    event.source === undefined ? undefined : (
                      <MessageAction
                        label="Open Slack channel"
                        kind="link"
                        render={
                          <a
                            href={`https://app.slack.com/client/${encodeURIComponent(event.source.teamId)}/${encodeURIComponent(event.source.channelId)}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <MessageSquare size={16} aria-hidden />
                      </MessageAction>
                    )
                  }
                >
                  <Prose>{event.text}</Prose>
                </Message>
              )}
              {event.type === EventType.TurnAnswered && (
                <Message
                  author={name}
                  avatar={avatar}
                  meta={<ConsoleTimestamp value={event.occurredAt} />}
                  actions={
                    <>
                      {inspect(event.turnId)}
                      <CopyValue
                        value={event.reply}
                        label="reply"
                        title="Copy reply"
                        display="icon"
                        render={<MessageAction label="Copy reply" />}
                      />
                    </>
                  }
                >
                  <Markdown>{event.reply}</Markdown>
                </Message>
              )}
              {event.type === EventType.TurnUnanswered && (
                <Message
                  author={name}
                  avatar={avatar}
                  kind="system"
                  meta={<ConsoleTimestamp value={event.occurredAt} />}
                  actions={inspect(event.turnId)}
                >
                  <Prose>{outcomeReason(event.reason)}</Prose>
                </Message>
              )}
              {event.type === EventType.DroneReported && (
                <Message author="Delegated work" kind="assistant" meta={<ConsoleTimestamp value={event.occurredAt} />}>
                  <Markdown>{event.report}</Markdown>
                </Message>
              )}
              {event.type === EventType.MechForked && (
                <MessageBoundary label="Conversation continued from another mech">
                  <Stack compact>
                    <Muted>
                      History was copied through event {event.forkedFrom.sequence}. Each mech continues independently
                      after this point.
                    </Muted>
                    <Row>
                      {sourceLink(event.forkedFrom.mechId)}
                      <ConsoleTimestamp value={event.occurredAt} />
                    </Row>
                  </Stack>
                </MessageBoundary>
              )}
            </Conversation.Item>
          ))}
        </Conversation.Content>
      </Conversation.Viewport>
      <Conversation.JumpToLatest />
    </Conversation.Root>
  );
}

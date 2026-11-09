import { CopyValue, Identifier, Muted, Prose, Row, Stack, TextLink } from '@mechane-ai/elements';
import { Timeline } from '@mechane-ai/elements/collections';
import { Markdown, MarkdownPreview } from '@mechane-ai/elements/content/markdown';
import { EmptyState, Skeleton, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageContent } from '@mechane-ai/elements/layout';
import { colors, typography } from '@mechane-ai/elements/tokens.stylex';
import { Event } from '@mechane/protocol';
import type { EventPage, ListedEvent, Turn } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Schema } from 'effect';
import { Bell, Check, Circle, GitFork, MessageSquare, Play, Reply, Square, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { preciseTimeLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';

const styles = stylex.create({
  preview: {
    margin: 0,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    color: colors.muted,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
});

export function ActivityPlaceholder({ hasInset = true }: { readonly hasInset?: boolean }): ReactNode {
  return (
    <ActivityFrame hasInset={hasInset}>
      <Timeline.Root label="Activity">
        {[0, 1, 2].map((item) => (
          <Timeline.Item
            key={item}
            icon={<Skeleton width={14} height={14} shape="circle" />}
            title={<SkeletonText width="14ch" />}
            time={<SkeletonText width="10ch" />}
          >
            <SkeletonText lines={2} width="80%" />
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </ActivityFrame>
  );
}

export function Activity({
  page,
  label = 'Mech activity',
  hasInset = true,
  expandedSequence,
  runLink,
}: {
  readonly page: EventPage;
  readonly label?: string;
  readonly hasInset?: boolean;
  readonly expandedSequence?: number | undefined;
  readonly runLink?: (turnId: Turn['id'], sequence: number) => ReactNode;
}): ReactNode {
  return (
    <ActivityFrame hasInset={hasInset}>
      {page.events.length === 0 ? (
        <EmptyState title="No activity yet">
          Notifications and execution events appear here as the mech works.
        </EmptyState>
      ) : (
        <Timeline.Root label={label}>
          {page.events.map((event) => (
            <EventItem
              key={event.sequence}
              event={event}
              isExpanded={event.sequence === expandedSequence}
              runLink={runLink}
            />
          ))}
        </Timeline.Root>
      )}
    </ActivityFrame>
  );
}

function ActivityFrame({
  children,
  hasInset,
}: {
  readonly children: ReactNode;
  readonly hasInset: boolean;
}): ReactNode {
  return hasInset ? <PageContent>{children}</PageContent> : children;
}

function EventItem({
  event,
  isExpanded,
  runLink,
}: {
  readonly event: ListedEvent;
  readonly isExpanded: boolean;
  readonly runLink: ((turnId: Turn['id'], sequence: number) => ReactNode) | undefined;
}): ReactNode {
  const known = Schema.is(Event)(event);
  const preview = known ? eventPreview(event) : undefined;

  return (
    <Timeline.Item
      icon={<EventIcon type={event.type} />}
      title={eventLabel(event.type)}
      time={known ? <ConsoleTimestamp value={event.occurredAt} /> : undefined}
      defaultOpen={isExpanded}
      details={
        <Stack isCompact>
          {known ? <EventContent event={event} /> : <Muted>Newer event format</Muted>}
          <Row>
            <Identifier>Event #{event.sequence}</Identifier>
            {known && <CopyValue label="event timestamp" value={preciseTimeLabel(event.occurredAt)} />}
            {known && runLink !== undefined && <RunLink event={event} render={runLink} />}
          </Row>
        </Stack>
      }
    >
      {preview !== undefined && <p {...stylex.props(styles.preview)}>{preview}</p>}
    </Timeline.Item>
  );
}

function RunLink({
  event,
  render,
}: {
  readonly event: Event;
  readonly render: (turnId: Turn['id'], sequence: number) => ReactNode;
}): ReactNode {
  return 'turnId' in event ? render(event.turnId, event.sequence) : null;
}

const PREVIEW_LENGTH = 200;

function eventPreview(event: Event): ReactNode {
  if ('text' in event) {
    return previewLine(event.text);
  }

  if ('reply' in event) {
    return <MarkdownPreview>{previewLine(event.reply)}</MarkdownPreview>;
  }

  return undefined;
}

function previewLine(text: string): string {
  const line = text.trim().split('\n', 1)[0] ?? '';

  if (line.length <= PREVIEW_LENGTH) {
    return line;
  }

  return `${line.slice(0, PREVIEW_LENGTH).replace(/\s+\S*$/, '')}…`;
}

function EventIcon({ type }: { readonly type: string }): ReactNode {
  switch (type) {
    case 'inbox_item.received':
      return <MessageSquare size={14} />;
    case 'notification.received':
      return <Bell size={14} />;
    case 'console.message':
      return <MessageSquare size={14} />;
    case 'activation.completed':
      return <Check size={14} />;
    case 'activation.failed':
      return <TriangleAlert size={14} />;
    case 'activation.stopped':
      return <Square size={14} />;
    case 'turn.answered':
      return <Reply size={14} />;
    case 'mech.forked':
      return <GitFork size={14} />;
    case 'turn.started':
    case 'activation.started':
      return <Play size={14} />;
    default:
      return <Circle size={12} />;
  }
}

function EventContent({ event }: { readonly event: Event }): ReactNode {
  if (event.type === 'notification.received') {
    return (
      <Stack isCompact>
        <Prose>{event.text}</Prose>
        <Row>
          <Muted>{event.source.name}</Muted>
          {event.source.url !== undefined && <TextLink href={event.source.url}>Open source</TextLink>}
          <CopyValue label="notification ID" value={event.notificationId} />
        </Row>
      </Stack>
    );
  }

  if ('forkedFrom' in event) {
    return (
      <Muted>
        Context and history were copied through event {event.forkedFrom.sequence} from mech {event.forkedFrom.mechId}.
        Each mech continues independently. Sandbox files stay with the source mech.
      </Muted>
    );
  }

  if ('text' in event) {
    return <Prose>{event.text}</Prose>;
  }

  if ('reply' in event) {
    return <Markdown>{event.reply}</Markdown>;
  }

  if ('reason' in event) {
    return <Muted>{event.reason}</Muted>;
  }

  if ('turnId' in event) {
    return <CopyValue label="run ID" value={event.turnId} />;
  }

  return null;
}

function eventLabel(type: string): string {
  switch (type) {
    case 'notification.received':
      return 'Notification received';
    case 'activation.started':
      return 'Run started';
    case 'activation.completed':
      return 'Run completed';
    case 'activation.failed':
      return 'Run failed';
    case 'activation.stopped':
      return 'Run stopped';
    case 'console.message':
      return 'Message sent to Console';
    case 'inbox_item.received':
      return 'Message received';
    case 'turn.started':
      return 'Run started';
    case 'turn.canceled':
      return 'Cancellation requested';
    case 'turn.answered':
      return 'Reply';
    case 'turn.unanswered':
      return 'Run ended';
    case 'mech.forked':
      return 'Conversation continued';
    default:
      return type.replaceAll(/[._]/g, ' ');
  }
}

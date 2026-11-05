import { CopyValue, Identifier, Muted, Prose, Row, Stack } from '@mechane-ai/elements';
import { Timeline } from '@mechane-ai/elements/collections';
import { Markdown, MarkdownPreview } from '@mechane-ai/elements/content/markdown';
import { EmptyState, Skeleton, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageContent } from '@mechane-ai/elements/layout';
import { colors, typography } from '@mechane-ai/elements/tokens.stylex';
import { Event } from '@mechane/protocol';
import type { EventPage, ListedEvent, Turn } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Schema } from 'effect';
import { Circle, GitFork, MessageSquare, Play, Reply } from 'lucide-react';
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

export function ActivityPlaceholder({ inset = true }: { readonly inset?: boolean }): ReactNode {
  return (
    <ActivityFrame inset={inset}>
      <Timeline.Root label="History">
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
  label = 'Mech history',
  inset = true,
  expandedSequence,
  runLink,
}: {
  readonly page: EventPage;
  readonly label?: string;
  readonly inset?: boolean;
  readonly expandedSequence?: number | undefined;
  readonly runLink?: (turnId: Turn['id'], sequence: number) => ReactNode;
}): ReactNode {
  return (
    <ActivityFrame inset={inset}>
      {page.events.length === 0 ? (
        <EmptyState title="No activity yet">Messages and execution events appear here as the mech works.</EmptyState>
      ) : (
        <Timeline.Root label={label}>
          {page.events.map((event) => (
            <EventItem
              key={event.sequence}
              event={event}
              expanded={event.sequence === expandedSequence}
              runLink={runLink}
            />
          ))}
        </Timeline.Root>
      )}
    </ActivityFrame>
  );
}

function ActivityFrame({ children, inset }: { readonly children: ReactNode; readonly inset: boolean }): ReactNode {
  return inset ? <PageContent>{children}</PageContent> : children;
}

function EventItem({
  event,
  expanded,
  runLink,
}: {
  readonly event: ListedEvent;
  readonly expanded: boolean;
  readonly runLink: ((turnId: Turn['id'], sequence: number) => ReactNode) | undefined;
}): ReactNode {
  const known = Schema.is(Event)(event);
  const preview = known ? eventPreview(event) : undefined;

  return (
    <Timeline.Item
      icon={<EventIcon type={event.type} />}
      title={eventLabel(event.type)}
      time={known ? <ConsoleTimestamp value={event.occurredAt} /> : undefined}
      defaultOpen={expanded}
      details={
        <Stack compact>
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

  if ('report' in event) {
    return <MarkdownPreview>{previewLine(event.report)}</MarkdownPreview>;
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
    case 'turn.answered':
      return <Reply size={14} />;
    case 'mech.forked':
      return <GitFork size={14} />;
    case 'turn.started':
      return <Play size={14} />;
    default:
      return <Circle size={12} />;
  }
}

function EventContent({ event }: { readonly event: Event }): ReactNode {
  if ('forkedFrom' in event) {
    return (
      <Muted>
        History was copied through event {event.forkedFrom.sequence} from mech {event.forkedFrom.mechId}. Each mech
        continues independently from this point.
      </Muted>
    );
  }

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
    return <CopyValue label="run ID" value={event.turnId} />;
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
      return 'Run started';
    case 'turn.joined':
      return 'Message joined';
    case 'turn.canceled':
      return 'Cancellation requested';
    case 'turn.answered':
      return 'Reply';
    case 'turn.unanswered':
      return 'Run ended';
    case 'drone.reported':
      return 'Delegated work reported';
    case 'mech.forked':
      return 'Conversation continued';
    default:
      return type.replaceAll(/[._]/g, ' ');
  }
}

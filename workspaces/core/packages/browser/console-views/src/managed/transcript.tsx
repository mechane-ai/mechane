import { CopyValue, Row, Text, TextButton } from '@mechane-ai/elements';
import { Approval, Conversation, Message, MessageAction } from '@mechane-ai/elements/ai';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ManagedTimestamp } from './timestamp.tsx';

const toolUseTypes: ReadonlySet<string> = new Set(['agent.tool_use', 'agent.mcp_tool_use']);

type SessionEvent = {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly processedAt: string | null;
  readonly threadId: string | null;
  readonly toolName: string | null;
  readonly stopReason: string | null;
  readonly permission: string | null;
};

type Approvals = {
  readonly pendingApprovalIds?: ReadonlySet<string> | undefined;
  readonly onConfirm?: ((eventId: string, allow: boolean) => void) | undefined;
  readonly confirmingEventId?: string | undefined;
};

function eventTitle(event: SessionEvent): string {
  switch (event.type) {
    case 'agent.tool_use':
    case 'agent.custom_tool_use':
    case 'agent.mcp_tool_use':
      return event.toolName === null ? 'Tool call' : `Tool call · ${event.toolName}`;
    case 'agent.tool_result':
    case 'user.tool_result':
    case 'user.custom_tool_result':
    case 'agent.mcp_tool_result':
      return event.toolName === null ? 'Tool result received' : `Result · ${event.toolName}`;
    case 'agent.thinking':
      return 'Thinking';
    case 'user.tool_confirmation':
      return 'Tool decision received';
    case 'user.interrupt':
      return 'Interrupt requested';
    case 'session.status_idle':
      return event.stopReason === null ? 'Session idle' : `Session idle · ${event.stopReason.replaceAll('_', ' ')}`;
    case 'session.status_running':
      return 'Session running';
    case 'session.status_terminated':
      return 'Session ended';
    case 'session.thread_created':
      return 'Thread created';
    case 'agent.thread_context_compacted':
      return 'Thread context compacted';
    case 'agent.thread_message_received':
      return 'Thread message received';
    case 'agent.thread_message_sent':
      return 'Thread message sent';
    case 'session.error':
      return 'Session error';
    default:
      return event.type;
  }
}

function SelectedEvent({ children }: { readonly children: ReactNode }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const item = ref.current;

    item?.focus({ preventScroll: true });
    item?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, []);

  return (
    <div role="region" tabIndex={-1} aria-label="Linked event" ref={ref}>
      {children}
    </div>
  );
}

function TranscriptEvent({
  event,
  agentName,
  approvals,
  href,
}: {
  readonly event: SessionEvent;
  readonly agentName: string;
  readonly approvals: Approvals;
  readonly href: string | undefined;
}): ReactNode {
  const isUser = event.type === 'user.message';
  const isAgent = event.type === 'agent.message';
  const timestamp = event.processedAt === null ? undefined : <ManagedTimestamp value={event.processedAt} />;

  const metadata =
    href === undefined ? (
      timestamp
    ) : (
      <Row>
        {timestamp}
        <CopyValue label="event link" value={href} display="icon" render={<MessageAction label="Copy event link" />} />
      </Row>
    );

  if (isUser || isAgent) {
    return (
      <Message
        author={isUser ? 'User' : agentName}
        kind={isUser ? 'user' : 'assistant'}
        meta={isUser && event.processedAt === null ? 'Pending' : metadata}
        actions={
          event.text !== '' && (
            <CopyValue
              value={event.text}
              label="message"
              title="Copy message"
              display="icon"
              render={<MessageAction label="Copy message" />}
            />
          )
        }
      >
        {event.text === '' ? (
          <Text tone="muted">Message contains no text.</Text>
        ) : (
          <Markdown headingLevel={3}>{event.text}</Markdown>
        )}
      </Message>
    );
  }

  const isToolUse = toolUseTypes.has(event.type);
  const requiresConfirmation = isToolUse && event.permission === 'ask';
  const isPending = approvals.pendingApprovalIds?.has(event.id) === true;
  const onConfirm = approvals.onConfirm;
  const title = eventTitle(event);

  if (requiresConfirmation && isPending && onConfirm !== undefined) {
    return (
      <Approval
        status="pending"
        requestId={event.id}
        title={event.toolName === null ? 'Allow this tool call?' : `Allow ${event.toolName}?`}
        {...(event.text.length === 0 ? {} : { description: event.text })}
        isDisabled={approvals.confirmingEventId !== undefined}
        onApprove={() => onConfirm(event.id, true)}
        onDeny={() => onConfirm(event.id, false)}
      />
    );
  }

  if (event.type === 'session.error') {
    return <Notice hasError>{event.text.length === 0 ? title : event.text}</Notice>;
  }

  return (
    <Row>
      <Text tone="muted" variant="caption">
        {title}
      </Text>
      {isToolUse && event.text.length > 0 && <Text variant="caption">{event.text}</Text>}
      {metadata}
    </Row>
  );
}

export function SessionTranscript({
  events,
  agentName,
  threadId,
  controls,
  onOpenThread,
  eventHref,
  selectedEventId,
  reader,
  ...approvals
}: Approvals & {
  readonly events: ReadonlyArray<SessionEvent>;
  readonly agentName: string;
  readonly threadId?: string | undefined;
  readonly controls?: ReactNode;
  readonly eventHref?: ((id: string, through: string) => string) | undefined;
  readonly selectedEventId?: string | undefined;
  readonly reader: {
    readonly id: string;
    readonly position?: { readonly top: number; readonly left?: number } | undefined;
  };
  readonly onOpenThread?: ((id: string) => void) | undefined;
}): ReactNode {
  return (
    <Conversation.Root
      shouldFollow={selectedEventId === undefined}
      initialPosition={selectedEventId === undefined ? reader.position : 'end'}
    >
      <Conversation.Viewport label="Session conversation" scrollRestorationId={reader.id}>
        <Conversation.Content>
          {controls}
          {events.length === 0 && <EmptyState title="No events yet" />}
          {events.map((event) => {
            const thread = threadId === undefined ? event.threadId : null;

            const detail = (
              <TranscriptEvent
                event={event}
                agentName={agentName}
                approvals={approvals}
                href={event.processedAt === null ? undefined : eventHref?.(event.id, event.processedAt)}
              />
            );

            return (
              <Conversation.Item key={event.id} messageId={event.id}>
                {selectedEventId === event.id ? <SelectedEvent>{detail}</SelectedEvent> : detail}
                {thread !== null && onOpenThread !== undefined && (
                  <TextButton onClick={() => onOpenThread(thread)}>Open thread</TextButton>
                )}
              </Conversation.Item>
            );
          })}
        </Conversation.Content>
      </Conversation.Viewport>
      <Conversation.JumpToLatest />
    </Conversation.Root>
  );
}

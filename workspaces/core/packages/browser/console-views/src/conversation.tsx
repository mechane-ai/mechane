import { CopyValue, Stack } from '@mechane-ai/elements';
import { Conversation, Message, MessageAction } from '@mechane-ai/elements/ai';
import type { ConversationRootProps } from '@mechane-ai/elements/ai';
import { Timestamp } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState, SkeletonText } from '@mechane-ai/elements/feedback';
import type { ConsoleMessage } from '@mechane/protocol';
import { PresentationOutput } from '@mechane/protocol/presentation';
import { DateTime, Option } from 'effect';
import type { ReactNode, RefObject } from 'react';
import { StructuredMessage } from './structured-message.tsx';

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

export function ConversationPlaceholder(): ReactNode {
  return (
    <Conversation.Root shouldFollow={false}>
      <Conversation.Viewport label="Conversation">
        <Conversation.Content>
          <Message author="" kind="user" avatar={<SkeletonText width="8ch" />}>
            <SkeletonText lines={2} width="70%" />
          </Message>
          <Message author="" avatar={<SkeletonText width="12ch" />}>
            <SkeletonText lines={4} />
          </Message>
        </Conversation.Content>
      </Conversation.Viewport>
    </Conversation.Root>
  );
}

export function MechConversation({
  messages,
  name,
  avatar,
  controls,
  updates,
  viewportRef,
  initialPosition,
  scrollRestorationId,
  inspect,
}: {
  readonly messages: ReadonlyArray<ConsoleMessage>;
  readonly name: string;
  readonly avatar?: ReactNode;
  readonly controls: ReactNode;
  readonly updates?: ReactNode;
  readonly viewportRef?: RefObject<HTMLDivElement | null>;
  readonly initialPosition?: ConversationRootProps['initialPosition'];
  readonly scrollRestorationId: string;
  readonly inspect: (runId: string) => ReactNode;
}): ReactNode {
  return (
    <Conversation.Root viewportRef={viewportRef} initialPosition={initialPosition}>
      <Conversation.Viewport label={`${name} conversation`} scrollRestorationId={scrollRestorationId}>
        <Conversation.Content>
          {controls}
          {messages.length === 0 && (
            <EmptyState title="Start a conversation">Send a message below to work with {name}.</EmptyState>
          )}
          {messages.map((message) => (
            <Conversation.Item key={message.id} messageId={message.id}>
              <ConversationMessage message={message} name={name} avatar={avatar} inspect={inspect} />
            </Conversation.Item>
          ))}
        </Conversation.Content>
      </Conversation.Viewport>
      {updates === undefined ? <Conversation.JumpToLatest /> : <Conversation.Controls>{updates}</Conversation.Controls>}
    </Conversation.Root>
  );
}

function ConversationMessage({
  message,
  name,
  avatar,
  inspect,
}: {
  readonly message: ConsoleMessage;
  readonly name: string;
  readonly avatar: ReactNode;
  readonly inspect: (runId: string) => ReactNode;
}): ReactNode {
  const recordedPresentation = Option.getOrUndefined(message.presentation);
  const presentation = PresentationOutput.safeParse(recordedPresentation);
  const createdAt = DateTime.formatIso(message.createdAt);
  const isUser = message.role === 'user';
  const isPresentationFallback = presentation.success && presentation.data.fallback.trim() === message.text.trim();

  return (
    <Message
      author={isUser ? 'User' : name}
      kind={isUser ? 'user' : 'assistant'}
      avatar={isUser ? undefined : avatar}
      meta={<Timestamp dateTime={createdAt} label={timestampFormatter.format(new Date(createdAt))} title={createdAt} />}
      actions={
        <>
          {Option.isSome(message.runId) && inspect(message.runId.value)}
          <CopyValue
            value={message.text}
            label="message"
            title="Copy message"
            display="icon"
            render={<MessageAction label="Copy message" />}
          />
        </>
      }
    >
      <Stack isCompact>
        {message.text.length > 0 && !isPresentationFallback && <Markdown headingLevel={3}>{message.text}</Markdown>}
        {presentation.success && (
          <StructuredMessage value={presentation.data.spec} fallback={presentation.data.fallback} />
        )}
      </Stack>
    </Message>
  );
}

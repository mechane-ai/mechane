import { Collapsible, CopyValue, Muted, Stack, Status } from '@mechane-ai/elements';
import { Conversation, Message, MessageAction, MessageAttachment } from '@mechane-ai/elements/ai';
import type { ConversationRootProps } from '@mechane-ai/elements/ai';
import { Timestamp } from '@mechane-ai/elements/collections';
import { ContentLink } from '@mechane-ai/elements/content/link';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState, SkeletonText } from '@mechane-ai/elements/feedback';
import { PresentationOutput, PresentationSpecification } from '@mechane/protocol/presentation';
import { getToolName, isToolUIPart } from 'ai';
import type { DynamicToolUIPart, ToolUIPart, UIMessage } from 'ai';
import type { ReactNode, RefObject } from 'react';
import { z } from 'zod';
import { readMessagePresentation, StructuredMessage } from './structured-message.tsx';

const messageMetadata = z.object({
  runId: z.string().min(1).max(128).optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
});

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

type ToolPart = ToolUIPart | DynamicToolUIPart;

const attachmentPartTypes: ReadonlySet<UIMessage['parts'][number]['type']> = new Set([
  'file',
  'source-url',
  'source-document',
]);

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
  isStreaming = false,
}: {
  readonly messages: ReadonlyArray<UIMessage>;
  readonly name: string;
  readonly avatar?: ReactNode;
  readonly controls: ReactNode;
  readonly updates?: ReactNode;
  readonly viewportRef?: RefObject<HTMLDivElement | null>;
  readonly initialPosition?: ConversationRootProps['initialPosition'];
  readonly scrollRestorationId: string;
  readonly inspect: (runId: string) => ReactNode;
  readonly isStreaming?: boolean;
}): ReactNode {
  const visibleMessages = messages.filter((message) => message.role !== 'system');

  return (
    <Conversation.Root viewportRef={viewportRef} initialPosition={initialPosition}>
      <Conversation.Viewport label={`${name} conversation`} scrollRestorationId={scrollRestorationId}>
        <Conversation.Content>
          {controls}
          {visibleMessages.length === 0 && (
            <EmptyState title="Start a conversation">Send a message below to work with {name}.</EmptyState>
          )}
          {visibleMessages.map((message, index) => (
            <Conversation.Item key={message.id} messageId={message.id}>
              <ConversationMessage
                message={message}
                name={name}
                avatar={avatar}
                inspect={inspect}
                isStreaming={isStreaming && index === visibleMessages.length - 1 && message.role === 'assistant'}
              />
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
  isStreaming,
}: {
  readonly message: UIMessage;
  readonly name: string;
  readonly avatar: ReactNode;
  readonly inspect: (runId: string) => ReactNode;
  readonly isStreaming: boolean;
}): ReactNode {
  const metadata = messageMetadata.safeParse(message.metadata);
  const runId = metadata.success ? metadata.data.runId : undefined;
  const createdAt = metadata.success ? metadata.data.createdAt : undefined;
  const { text, specification } = readMessagePresentation(message.parts);

  const sourceText = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n');

  const hasSpecPart = message.parts.some((part) => part.type === 'data-spec');
  const tools = message.parts.filter(isToolUIPart);
  const structuredResult = tools.find((part) => getToolName(part) === 'render_ui' && part.state === 'output-available');

  const presentation =
    structuredResult?.state === 'output-available' ? PresentationOutput.safeParse(structuredResult.output) : undefined;

  const fallback = presentation?.success === true ? presentation.data.fallback : text;
  const resultSpec = specification ?? (presentation?.success === true ? presentation.data.spec : undefined);
  const validatedSpec = PresentationSpecification.safeParse(resultSpec);
  const isFallbackNarration = presentation?.success === true && text.trim() === presentation.data.fallback.trim();
  const shouldShowText = text.length > 0 && (!validatedSpec.success || !isFallbackNarration);
  const hasStructuredContent = resultSpec !== undefined || hasSpecPart;
  const needsStructuredFallback = hasStructuredContent && text.length === 0;
  const shouldShowStructured = validatedSpec.success || needsStructuredFallback;
  const isUser = message.role === 'user';

  const hasAttachments = message.parts.some((part) => attachmentPartTypes.has(part.type));
  const hasNarration = text.length > 0 || tools.length > 0;
  const hasReadableContent = hasNarration || hasStructuredContent || hasAttachments;

  return (
    <Message
      author={isUser ? 'User' : name}
      kind={isUser ? 'user' : 'assistant'}
      avatar={isUser ? undefined : avatar}
      meta={
        createdAt === undefined ? undefined : (
          <Timestamp dateTime={createdAt} label={timestampFormatter.format(new Date(createdAt))} title={createdAt} />
        )
      }
      actions={
        <>
          {runId !== undefined && inspect(runId)}
          {(text.length > 0 || fallback.length > 0) && (
            <CopyValue
              value={sourceText.length > 0 ? sourceText : fallback}
              label="message"
              title="Copy message"
              display="icon"
              render={<MessageAction label="Copy message" />}
            />
          )}
        </>
      }
    >
      <Stack isCompact>
        {tools.length > 0 && (
          <Collapsible.Root>
            <Collapsible.Trigger>
              {tools.length} tool {tools.length === 1 ? 'call' : 'calls'}
            </Collapsible.Trigger>
            <Collapsible.Panel>
              <Stack isCompact>
                {tools.map((part) => (
                  <ToolActivity key={part.toolCallId} part={part} />
                ))}
              </Stack>
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
        {shouldShowText && (
          <Markdown headingLevel={3} isStreaming={isStreaming}>
            {text}
          </Markdown>
        )}
        {shouldShowStructured && <StructuredMessage value={resultSpec} fallback={fallback} isStreaming={isStreaming} />}
        {message.parts.map((part) => {
          if (part.type === 'file') {
            return (
              <MessageAttachment
                key={`${part.url}:${part.filename ?? ''}`}
                name={part.filename ?? 'Attachment'}
                description={part.mediaType}
                href={part.url}
              />
            );
          }

          if (part.type === 'source-url') {
            return (
              <ContentLink key={part.sourceId} href={part.url}>
                {part.title ?? part.url}
              </ContentLink>
            );
          }

          if (part.type === 'source-document') {
            return <MessageAttachment key={part.sourceId} name={part.title} description={part.mediaType} />;
          }

          return null;
        })}
        {!hasReadableContent && (
          <Muted>{isStreaming ? 'Working…' : 'This content is unavailable in the conversation.'}</Muted>
        )}
      </Stack>
    </Message>
  );
}

function ToolActivity({ part }: { readonly part: ToolPart }): ReactNode {
  const name = getToolName(part).replaceAll('_', ' ');

  switch (part.state) {
    case 'input-streaming':
      return <Status tone="neutral">Preparing {name}</Status>;
    case 'input-available':
      return <Status tone="neutral">Using {name}</Status>;
    case 'approval-requested':
      return <Status tone="warning">Waiting for approval · {name}</Status>;
    case 'approval-responded':
      return (
        <Status tone={part.approval.approved ? 'positive' : 'negative'}>
          {part.approval.approved ? 'Approved' : 'Declined'} · {name}
        </Status>
      );
    case 'output-available':
      return <Status tone="positive">Completed {name}</Status>;
    case 'output-error':
      return <Status tone="negative">Failed {name}</Status>;
    case 'output-denied':
      return <Status tone="negative">Denied {name}</Status>;
  }
}

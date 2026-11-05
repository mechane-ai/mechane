import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { ExternalLink, ScanLine } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Markdown } from '../../content/src/markdown/index.ts';
import { AgentAvatar, Button, CopyValue, Muted, Row, Stack, TextLink } from '../../core/src/index.ts';
import { colors, radii } from '../../foundations/src/tokens.stylex.ts';
import { Conversation } from './conversation.tsx';
import { MessageAction } from './message-action.tsx';
import { MessageBoundary } from './message-boundary.tsx';
import { Message, MessageAttachment } from './message.tsx';
import type { MessageKind } from './message.tsx';
import { PromptInput } from './prompt-input.tsx';

const meta = {
  title: 'AI/Conversation',
  component: Conversation.Root,
  subcomponents: {
    Viewport: Conversation.Viewport,
    Content: Conversation.Content,
    Item: Conversation.Item,
    JumpToLatest: Conversation.JumpToLatest,
    Message,
    MessageAction,
    MessageAttachment,
    MessageBoundary,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Conversation owns scrolling through MessageScroller. Supply stable message IDs, content and streaming state. Viewport owns the scroll region and can expose its identity for application route restoration. Content constrains the reading measure; Item preserves message identity; JumpToLatest returns to the live edge. Message presents authorship, body and optional avatar. Its action area reserves space and reveals controls on hover or keyboard focus; touch keeps them visible. MessageAction composes a named icon button or link with a tooltip. MessageBoundary discloses supplied lineage details. The application owns data, routing and draft lifetime. Use a height-constrained parent for a scrolling transcript, and key the root only when the conversation identity changes.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  frame: {
    height: 440,
    minHeight: 0,
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
  },
});

type ExampleMessage = {
  readonly id: string;
  readonly author: string;
  readonly kind: MessageKind;
  readonly text: string;
};

type SentMessage = { readonly id: string; readonly text: string };

const earlierMessages: ReadonlyArray<ExampleMessage> = [
  { id: 'history-question', author: 'You', kind: 'user', text: 'What should the report include?' },
  {
    id: 'history-answer',
    author: 'Assistant',
    kind: 'assistant',
    text: 'Include the evidence window, exact measurements, and any gaps in the available data.',
  },
];

const initialMessages: ReadonlyArray<ExampleMessage> = [
  {
    id: 'question',
    author: 'You',
    kind: 'user',
    text: 'Compare the two evaluation runs and suggest what to investigate.',
  },
  {
    id: 'answer',
    author: 'Assistant',
    kind: 'assistant',
    text: 'The second run improves the median score while leaving the slowest requests unchanged.\n\n- Compare the same evaluation cases.\n- Keep missing measurements separate from zero.\n- Inspect the longest requests before changing concurrency.\n\n```ts\nconst comparison = { baseline: 0.71, candidate: 0.76 };\n```',
  },
  { id: 'follow-up', author: 'You', kind: 'user', text: 'Can you prepare the next steps from that evidence?' },
];

function ConversationExample(): ReactNode {
  const [hasHistory, setHasHistory] = useState(false);
  const [isStreaming, setStreaming] = useState(false);
  const [response, setResponse] = useState('Start with the comparison cohort.');
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<ReadonlyArray<SentMessage>>([]);
  const messages = hasHistory ? [...earlierMessages, ...initialMessages] : initialMessages;

  return (
    <Stack>
      <Row>
        <Button disabled={hasHistory} onClick={() => setHasHistory(true)}>
          Load earlier history
        </Button>
        <Button
          onClick={() => {
            setStreaming(true);
            setResponse(
              `${response}\n\nKeep the baseline and candidate measurements together, then inspect any missing cases before making a conclusion.`,
            );
          }}
        >
          Append response
        </Button>
        <Button disabled={!isStreaming} onClick={() => setStreaming(false)}>
          Finish response
        </Button>
      </Row>
      <div {...stylex.props(styles.frame)}>
        <Conversation.Root>
          <Conversation.Viewport label="Evaluation conversation">
            <Conversation.Content streaming={isStreaming}>
              {messages.map((message) => (
                <Conversation.Item key={message.id} messageId={message.id}>
                  <Message author={message.author} kind={message.kind}>
                    <Markdown>{message.text}</Markdown>
                  </Message>
                </Conversation.Item>
              ))}
              <Conversation.Item messageId="response">
                <Message
                  author="Assistant"
                  avatar={<AgentAvatar seed="evaluation-assistant" size="sm" />}
                  actions={
                    <CopyValue
                      value={response}
                      label="response"
                      display="icon"
                      render={<MessageAction label="Copy response" />}
                    />
                  }
                >
                  <Markdown streaming={isStreaming}>{response}</Markdown>
                </Message>
              </Conversation.Item>
              {sent.map((message) => (
                <Conversation.Item key={message.id} messageId={message.id}>
                  <Message author="You" kind="user">
                    <Markdown>{message.text}</Markdown>
                  </Message>
                </Conversation.Item>
              ))}
            </Conversation.Content>
          </Conversation.Viewport>
          <Conversation.JumpToLatest />
        </Conversation.Root>
      </div>
      <PromptInput
        label="Follow-up message"
        value={draft}
        onValueChange={setDraft}
        enterBehavior="submit"
        onSubmit={() => {
          setSent([...sent, { id: `sent-${sent.length + 1}`, text: draft }]);
          setDraft('');
        }}
        description="Enter sends. Shift+Enter adds a line. These examples make no requests."
      />
    </Stack>
  );
}

export const Chat: Story = { render: () => <ConversationExample /> };

export const MessageParts: Story = {
  render: () => (
    <Stack>
      <Message
        author="You"
        kind="user"
        meta="Submitted"
        avatar={
          <MessageAction label="Open source message" kind="link" href="#source-message">
            <ExternalLink size={16} aria-hidden />
          </MessageAction>
        }
        attachments={
          <MessageAttachment name="evaluation.csv" description="24 cases · CSV" href="/examples/evaluation.csv" />
        }
      >
        <Markdown>Use these cases for the comparison.</Markdown>
      </Message>
      <Message
        author="Assistant"
        meta="Complete"
        avatar={<AgentAvatar seed="evaluation-assistant" size="sm" />}
        actions={
          <>
            <MessageAction label="Open execution" kind="link" href="#execution">
              <ScanLine size={16} aria-hidden />
            </MessageAction>
            <CopyValue
              value="The supplied cases are ready for comparison."
              label="message"
              display="icon"
              render={<MessageAction label="Copy message" />}
            />
          </>
        }
      >
        <Markdown>The supplied cases are ready for comparison.</Markdown>
      </Message>
      <Message author="System" kind="system">
        <Muted>This conversation contains a partial history. Earlier records are available separately.</Muted>
      </Message>
      <MessageBoundary label="Conversation continued from another assistant">
        <Stack compact>
          <Muted>The earlier history was copied. Each assistant continues independently from this point.</Muted>
          <TextLink href="#source-assistant">Source assistant</TextLink>
        </Stack>
      </MessageBoundary>
    </Stack>
  ),
};

export const Empty: Story = {
  render: () => (
    <div {...stylex.props(styles.frame)}>
      <Conversation.Root initialPosition="start">
        <Conversation.Viewport label="New conversation">
          <Conversation.Content>
            <Conversation.Item messageId="empty">
              <Muted>No messages yet. Start with a question.</Muted>
            </Conversation.Item>
          </Conversation.Content>
        </Conversation.Viewport>
        <Conversation.JumpToLatest />
      </Conversation.Root>
    </div>
  ),
};

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <ConversationExample />,
};

export const LongContent: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <div {...stylex.props(styles.frame)}>
      <Conversation.Root initialPosition="start">
        <Conversation.Viewport label="Long content conversation">
          <Conversation.Content>
            <Conversation.Item messageId="long-response">
              <Message
                author="Evaluation assistant for archived production observations"
                avatar={<AgentAvatar seed="long-content-assistant" size="sm" />}
                meta="Nov 4, 5:24 PM"
                actions={
                  <CopyValue
                    value="The comparison is ready."
                    label="message"
                    display="icon"
                    render={<MessageAction label="Copy message" />}
                  />
                }
              >
                <Markdown>
                  {
                    'The comparison is saved at `/workspace/evaluation/artifacts/production/observations/2026-11-04/archived-results/comparison-summary.json`.\n\n```ts\nconst artifact = "/workspace/evaluation/artifacts/production/observations/archived-results/comparison-summary.json";\n```'
                  }
                </Markdown>
              </Message>
            </Conversation.Item>
          </Conversation.Content>
        </Conversation.Viewport>
      </Conversation.Root>
    </div>
  ),
};

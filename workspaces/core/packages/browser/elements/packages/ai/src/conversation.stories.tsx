import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Markdown } from '../../content/src/markdown/index.ts';
import { Button, CopyValue, Muted, Row, Stack } from '../../core/src/index.ts';
import { colors, radii } from '../../foundations/src/tokens.stylex.ts';
import { Conversation } from './conversation.tsx';
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
    MessageAttachment,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Conversation owns scrolling through the headless MessageScroller primitive. Supply stable message IDs, message content and streaming state. It follows the live edge, preserves a reader’s position when history is prepended, and offers a keyboard-accessible return to latest. Viewport is the scroll owner, Content reports streaming state, Item preserves message identity, and JumpToLatest returns to the live edge. Message presents authorship, body and actions; MessageAttachment presents a supplied file reference without uploading or fetching it. Use ordinary Stack layout for content that needs no transcript scrolling. A height-constrained parent creates a scrolling transcript; ordinary document flow stays natural. Key the root by conversation identity when switching conversations.',
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
                  actions={
                    <CopyValue value={response} label="Copy response">
                      Copy
                    </CopyValue>
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
        attachments={
          <MessageAttachment name="evaluation.csv" description="24 cases · CSV" href="/examples/evaluation.csv" />
        }
      >
        <Markdown>Use these cases for the comparison.</Markdown>
      </Message>
      <Message
        author="Assistant"
        meta="Complete"
        actions={
          <CopyValue value="The supplied cases are ready for comparison." label="Copy message">
            Copy
          </CopyValue>
        }
      >
        <Markdown>The supplied cases are ready for comparison.</Markdown>
      </Message>
      <Message author="System" kind="system">
        <Muted>This conversation contains a partial history. Earlier records are available separately.</Muted>
      </Message>
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

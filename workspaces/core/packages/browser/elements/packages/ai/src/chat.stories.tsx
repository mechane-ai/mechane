import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Markdown } from '../../content/src/markdown/index.ts';
import { Button, Collapsible, Muted, Stack } from '../../core/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Conversation } from './conversation.tsx';
import { Message } from './message.tsx';
import { PromptInput } from './prompt-input.tsx';
import { ReplyIndicator } from './reply-indicator.tsx';

const styles = stylex.create({
  frame: { display: 'flex', flexDirection: 'column', minWidth: 0, height: 480, gap: spacing.lg },
});

type Scenario = 'fast' | 'tool' | 'interrupted';

type Turn = {
  id: string;
  text: string;
  answer: string;
  phase: 'sending' | 'unconfirmed' | 'working' | 'tool' | 'answer' | 'done' | 'stopped';
};

const words = [
  'Your latest ',
  '**submission** ',
  'was `scout-v3`',
  ' in Classic 1v1.\n\n',
  '```python\n',
  'print("ready")\n',
  '```',
];

const settledPhases: ReadonlySet<Turn['phase']> = new Set(['unconfirmed', 'done', 'stopped']);
const toolPhases: ReadonlySet<Turn['phase']> = new Set(['tool', 'answer', 'done', 'stopped']);

function Chat({ scenario }: { scenario: Scenario }) {
  const [draft, setDraft] = useState('Find my latest submission.');
  const [turn, setTurn] = useState<Turn>();
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  function clear() {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }

    timers.current = [];
  }

  useEffect(
    () => () => {
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
    },
    [],
  );

  function respond(id: string) {
    const delay = scenario === 'fast' ? 0 : 500;

    timers.current.push(
      setTimeout(() => setTurn((value) => (value?.id === id ? { ...value, phase: 'working' } : value)), delay),
    );

    if (scenario === 'tool') {
      timers.current.push(
        setTimeout(() => setTurn((value) => (value?.id === id ? { ...value, phase: 'tool' } : value)), 1000),
      );
    }

    for (let index = 0; index < words.length; index += 1) {
      timers.current.push(
        setTimeout(
          () =>
            setTurn((value) =>
              value?.id === id
                ? {
                    ...value,
                    answer: words.slice(0, index + 1).join(''),
                    phase: index === words.length - 1 ? 'done' : 'answer',
                  }
                : value,
            ),
          delay + (scenario === 'tool' ? 1300 : 400) + index * 180,
        ),
      );
    }
  }

  const active = turn !== undefined && !settledPhases.has(turn.phase);

  const showTool = scenario === 'tool' && turn !== undefined && toolPhases.has(turn.phase);

  const canStop = active && turn.phase !== 'sending';

  return (
    <div {...stylex.props(styles.frame)}>
      <Conversation.Root>
        <Conversation.Viewport label="Example conversation">
          <Conversation.Content isStreaming={active}>
            <Conversation.Item messageId="earlier">
              <Message author="Assistant" variant="chat">
                <Markdown>{'## Ready to help\n\nSelect text in this answer while the next reply streams.'}</Markdown>
              </Message>
            </Conversation.Item>
            {turn === undefined ? null : (
              <>
                <Conversation.Item messageId={turn.id}>
                  <Message author="You" kind="user" variant="chat">
                    <Markdown>{turn.text}</Markdown>
                  </Message>
                  {turn.phase === 'sending' ? (
                    <ReplyIndicator label="Sending…" delayMs={400} isAnimated={false} />
                  ) : null}
                  {turn.phase === 'unconfirmed' ? (
                    <Stack isCompact>
                      <Muted>Delivery unconfirmed</Muted>
                      <Button variant="ghost" onClick={() => respond(turn.id)}>
                        Retry send
                      </Button>
                    </Stack>
                  ) : null}
                </Conversation.Item>
                <Conversation.Item messageId={`reply:${turn.id}`}>
                  <Message author="Assistant" variant="chat">
                    <Stack isCompact>
                      {turn.phase === 'working' ? <ReplyIndicator label="Working…" /> : null}
                      {showTool ? (
                        <Collapsible.Root>
                          <Collapsible.Trigger>
                            {turn.phase === 'tool' ? 'Checking submissions…' : 'Checked submissions'}
                          </Collapsible.Trigger>
                          <Collapsible.Panel>
                            <Muted>Read the submitted policy and league status.</Muted>
                          </Collapsible.Panel>
                        </Collapsible.Root>
                      ) : null}
                      {turn.answer.length > 0 ? (
                        <Markdown isStreaming={turn.phase === 'answer'}>{turn.answer}</Markdown>
                      ) : null}
                      {turn.phase === 'stopped' ? <Muted>Stopped</Muted> : null}
                    </Stack>
                  </Message>
                </Conversation.Item>
              </>
            )}
          </Conversation.Content>
        </Conversation.Viewport>
        <Conversation.Controls>
          <Conversation.JumpToLatest label="Jump to latest" />
        </Conversation.Controls>
      </Conversation.Root>
      <PromptInput
        label="Message"
        value={draft}
        onValueChange={setDraft}
        enterBehavior="submit"
        isCompact
        isSubmitDisabled={draft.trim().length === 0 || active || turn?.phase === 'unconfirmed'}
        onStop={
          canStop
            ? () => {
                clear();
                setTurn((value) => (value === undefined ? undefined : { ...value, phase: 'stopped' }));
              }
            : undefined
        }
        onSubmit={() => {
          clear();

          const id = crypto.randomUUID();

          setTurn({ id, text: draft, answer: '', phase: 'sending' });
          setDraft('');

          if (scenario === 'interrupted') {
            timers.current.push(
              setTimeout(
                () => setTurn((value) => (value === undefined ? undefined : { ...value, phase: 'unconfirmed' })),
                900,
              ),
            );
          } else {
            respond(id);
          }
        }}
      />
    </div>
  );
}

const meta = {
  title: 'AI/Chat',
  component: Chat,
  args: { scenario: 'tool' },
  argTypes: { scenario: { control: 'select', options: ['fast', 'tool', 'interrupted'] } },
} satisfies Meta<typeof Chat>;

export default meta;
export const ConversationStates: StoryObj<typeof meta> = {};

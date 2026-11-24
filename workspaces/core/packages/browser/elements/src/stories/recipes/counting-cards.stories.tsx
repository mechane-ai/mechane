import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { createAgent } from '@ui-sdk/react/agent';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../packages/core/src/actions.tsx';
import { colors, radii, spacing, typography } from '../../../packages/foundations/src/tokens.stylex.ts';
import { createLearnerTrace, summarizeTrace } from '../../../packages/teaching/src/agent/learner-trace.ts';
import { playTour } from '../../../packages/teaching/src/agent/lesson-tour.ts';
import type { LessonTour } from '../../../packages/teaching/src/agent/lesson-tour.ts';
import { tutorTools } from '../../../packages/teaching/src/agent/tutor-tools.ts';
import { answerSources, articleOutline } from '../../../packages/teaching/src/article/article-outline.ts';
import { CountingCards, countingEssay, countingLesson } from '../../../recipes/counting-cards.tsx';

const meta = {
  title: 'Recipes/Counting Cards',
  component: CountingCards,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CountingCards>;

export default meta;
type Story = StoryObj<typeof meta>;

const args = {
  title: 'Counting cards',
  summary:
    'A model guesses the suit of the next card from what has been dealt. Deal, count and score its guesses on a synthetic twelve-card deck.',
};

export const Example: Story = { args };

export const Present: Story = { args: { ...args, view: 'present' } };

export const Static: Story = { args: { ...args, view: 'static' } };

export const Sheet: Story = { args: { ...args, view: 'sheet' } };

const TITLE = 'Counting cards';

/** A short guided walk: deal four, show the late count, compare the weights, then count the cards. */
const tour: LessonTour = [
  { beat: 'deck', state: 'four', say: 'Four cards are dealt: two spades and two hearts are gone.', hold: 'short' },
  { beat: 'count', state: 'late', say: 'Nine cards in, the count of what is left is lopsided.', hold: 'short' },
  { beat: 'readout', state: 'counter', say: 'With all the weight on the count the chance follows it.', hold: 'short' },
  { beat: 'counted', state: 'counts', say: 'The count is the dealt cards, sorted by suit.', hold: 'short' },
];

/** The value each prediction takes its answer from, read from the essay's markup. */
const answers = answerSources(articleOutline(countingEssay));

const styles = stylex.create({
  panel: {
    display: 'grid',
    gap: spacing.md,
    maxWidth: 720,
    marginInline: spacing.lg,
    marginBlockEnd: spacing.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm },
  line: { margin: 0, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  output: {
    margin: 0,
    padding: spacing.md,
    maxHeight: 220,
    overflow: 'auto',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    fontSize: typography.captionSize,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
});

/** The tool calls a tutor might make here: where the reader is, a param change and a state. */
const calls = [
  { id: 'place', label: 'Where is the reader?', tool: 'read_place', input: {} },
  { id: 'deal', label: 'Deal nine cards', tool: 'set_param', input: { name: 'dealt', value: 9 } },
  { id: 'state', label: 'Show “Weight 1”', tool: 'show_state', input: { state: 'counter' } },
] as const;

/** A tutor beside the essay: three tools, the reader's trace as a sentence, and a tour. */
function Tutor(): ReactNode {
  const [agent] = useState(() => createAgent());
  const tools = tutorTools({ agent, lesson: countingLesson, locale: 'en-US', article: TITLE, answers });
  const [result, setResult] = useState('Run a tool to see what the tutor gets back.');
  const [summary, setSummary] = useState('The reader has not acted yet.');
  const [said, setSaid] = useState('The tour has not started.');

  useEffect(() => {
    const trace = createLearnerTrace({ agent, lesson: countingLesson, article: TITLE });

    const stop = trace.subscribe(() =>
      setSummary(summarizeTrace({ record: trace.read(), lesson: countingLesson, locale: 'en-US', answers })),
    );

    return () => {
      stop();
      trace.stop();
    };
  }, [agent]);

  async function run(name: string, input: unknown): Promise<void> {
    const tool = tools.find((item) => item.name === name);

    setResult(tool === undefined ? `No tool ${name}.` : JSON.stringify(await tool.run(input), null, 2));
  }

  return (
    <section aria-label="Tutor" {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.buttons)}>
        {calls.map((call) => (
          <Button key={call.id} variant="outline" onClick={() => run(call.tool, call.input)}>
            {call.label}
          </Button>
        ))}
        <Button
          variant="outline"
          onClick={() => playTour({ agent, lesson: countingLesson, tour, onSay: (line) => setSaid(line) })}
        >
          Play the tour
        </Button>
      </div>
      <p aria-label="Tutor line" {...stylex.props(styles.line)}>
        {said}
      </p>
      <p aria-label="Trace summary" {...stylex.props(styles.line)}>
        {summary}
      </p>
      <pre aria-label="Tool result" {...stylex.props(styles.output)}>
        {result}
      </pre>
    </section>
  );
}

export const WithTutor: Story = {
  args,
  parameters: {
    docs: {
      description: {
        story:
          'A scripted tutor beside the essay. Its tools act through the UI SDK agent bridge and withhold the prediction’s answer until the reader commits; the trace summary counts only what the reader did, and the tour pauses when the reader acts.',
      },
    },
  },
  render: (story) => (
    <>
      <CountingCards {...story} />
      <Tutor />
    </>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart } from '../../../charts/src/cartesian/index.ts';
import { Button } from '../../../core/src/index.ts';
import { createAgent } from '../../../foundations/src/agent/index.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { Article } from '../article/article.tsx';
import { Beat } from '../article/beat.tsx';
import { Challenge } from '../article/challenge.tsx';
import { Figure } from '../article/figure.tsx';
import { Predict } from '../article/predict.tsx';
import { defineLesson } from '../lesson/define-lesson.ts';
import type { AnyLesson } from '../lesson/define-lesson.ts';
import { Lesson } from '../lesson/lesson.tsx';
import { ParamChoice, ParamSlider } from '../lesson/param-controls.tsx';
import { Param, Value } from '../lesson/param.tsx';
import { Playback } from '../lesson/playback.tsx';
import { Transport } from '../lesson/transport.tsx';
import { useLesson } from '../lesson/use-lesson.ts';
import { SceneNode } from '../scene/scene-node.tsx';
import { Scene } from '../scene/scene.tsx';
import { createLearnerTrace, summarizeTrace } from './learner-trace.ts';
import type { LearnerRecord } from './learner-trace.ts';
import type { AnswerSources, LessonAgent } from './lesson-bridge.ts';
import { playTour, tourFromTrace, validateTour } from './lesson-tour.ts';
import type { LessonTour, TourPlayer } from './lesson-tour.ts';
import { tutorTools } from './tutor-tools.ts';

const meta = {
  title: 'Teaching/Tutor',
  parameters: {
    docs: {
      description: {
        component:
          'A scripted stand-in for a tutor model beside a small lesson: each button runs one tool from tutorTools through the UI SDK agent bridge and shows its JSON result. The learner trace records only what the reader does, summarizeTrace turns it into facts for a prompt, and a tour plays on the shared clock and pauses when the reader acts. WithArticle adds an Article, whose prediction, hints and challenge reach the trace and read_place through the lesson-progress primitive; the answer stays withheld until the reader commits. The training curve and the coin are synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** One tool call of the scripted tutor. */
type ScriptCall = { readonly id: string; readonly label: string; readonly tool: string; readonly input: unknown };

const EPOCHS = [0, 5, 10, 15, 20] as const;
const LAST_EPOCH = 20;
const START_LOSS = 2.4;
const FLOOR_LOSS = 0.3;
const UNSTABLE_RATE = 0.3;
const COSINE_SLOWDOWN = 0.6;

/** A synthetic loss after `epoch` epochs: a larger rate falls faster until it is too large and the loss climbs. */
function lossAt({
  learningRate,
  schedule,
  epoch,
}: {
  readonly learningRate: number;
  readonly schedule: string;
  readonly epoch: number;
}): number {
  const rate = schedule === 'cosine' ? learningRate * COSINE_SLOWDOWN : learningRate;
  const settled = FLOOR_LOSS + (START_LOSS - FLOOR_LOSS) * Math.exp(-rate * epoch * 2);
  const overshoot = Math.max(0, rate - UNSTABLE_RATE) * epoch * 0.12;

  return settled + overshoot;
}

const training = defineLesson({
  id: 'learning-rate',
  title: 'How the learning rate shapes training',
  params: {
    learningRate: {
      kind: 'number',
      label: 'Learning rate',
      value: 0.05,
      min: 0.001,
      max: 1,
      step: 0.001,
      scale: 'log',
      format: { maximumFractionDigits: 3 },
    },
    schedule: {
      kind: 'choice',
      label: 'Schedule',
      value: 'constant',
      options: [
        { id: 'constant', label: 'Constant' },
        { id: 'cosine', label: 'Cosine' },
      ],
    },
    epoch: {
      kind: 'number',
      label: 'Epoch',
      value: LAST_EPOCH,
      min: 0,
      max: LAST_EPOCH,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: { loss: { label: 'Training loss', format: { maximumFractionDigits: 2 }, from: (values) => lossAt(values) } },
  beats: [
    {
      id: 'rate',
      title: 'The learning rate sets the step size',
      goal: 'A larger rate lowers the loss faster, until it is so large the loss climbs.',
      misconception: 'A larger learning rate is always faster.',
      hints: ['Compare 0.001 with 0.05 before trying 0.8.'],
      states: [
        { id: 'too-small', label: 'Too small', values: { learningRate: 0.001 } },
        { id: 'too-large', label: 'Too large', values: { learningRate: 0.8 } },
      ],
    },
    {
      id: 'schedule',
      title: 'A schedule shrinks the step',
      goal: 'A cosine schedule trades early speed for a steadier end.',
      steps: 1,
      states: [{ id: 'cosine', label: 'Cosine', values: { schedule: 'cosine', learningRate: 0.5 } }],
    },
    {
      id: 'epochs',
      title: 'Training runs epoch by epoch',
      goal: 'The loss falls fastest in the first epochs.',
      states: [{ id: 'early', label: 'Early', values: { epoch: 5 } }],
    },
  ],
});

const tour: LessonTour = [
  { beat: 'rate', state: 'too-small', say: 'Start with a tiny learning rate: the loss barely moves.', hold: 'short' },
  { state: 'too-large', say: 'Now a rate far too large: the loss climbs again.', hold: 'short' },
  { beat: 'schedule', state: 'cosine', say: 'A cosine schedule shrinks the step as training goes on.', hold: 'short' },
  { beat: 'epochs', values: { epoch: 5 }, say: 'Five epochs in, most of the drop has happened.', hold: 'short' },
];

/** The scripted tutor: the tool calls a model might make, in the order a session might make them. */
const script = [
  { id: 'outline', label: 'Read the outline', tool: 'read_outline', input: {} },
  { id: 'place', label: 'Where is the reader?', tool: 'read_place', input: {} },
  { id: 'rate', label: 'Set the rate to 0.3', tool: 'set_param', input: { name: 'learningRate', value: 0.3 } },
  {
    id: 'both',
    label: 'Set rate and schedule at once',
    tool: 'set_params',
    input: { values: { learningRate: 0.5, schedule: 'cosine' } },
  },
  { id: 'large', label: 'Show “Too large”', tool: 'show_state', input: { state: 'too-large' } },
  { id: 'beat', label: 'Go to the schedule beat', tool: 'go_to_beat', input: { beat: 'schedule' } },
  { id: 'next', label: 'Next', tool: 'next', input: {} },
  { id: 'previous', label: 'Previous', tool: 'previous', input: {} },
  { id: 'play', label: 'Play the epochs', tool: 'play', input: { name: 'epoch' } },
  { id: 'pause', label: 'Pause', tool: 'pause', input: {} },
  { id: 'inspect', label: 'Inspect epoch 10', tool: 'inspect_figure', input: { figure: 'Loss by epoch', id: 'e10' } },
] as const satisfies ReadonlyArray<ScriptCall>;

const LOW_SURPRISE = 0.5;

/** The surprise of one toss in bits, for a coin that lands heads with chance `heads`. */
function entropyOf(heads: number): number {
  return -(heads * Math.log2(heads) + (1 - heads) * Math.log2(1 - heads));
}

const coin = defineLesson({
  id: 'coin-surprise',
  title: 'Surprise in one toss',
  params: {
    heads: {
      kind: 'number',
      label: 'Chance of heads',
      value: 0.5,
      min: 0.05,
      max: 0.95,
      step: 0.05,
      format: { maximumFractionDigits: 2 },
    },
  },
  derived: {
    entropy: {
      label: 'Surprise per toss',
      format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 },
      from: ({ heads }) => entropyOf(heads),
    },
  },
  beats: [
    {
      id: 'toss',
      title: 'A fair coin is the most surprising',
      goal: 'Surprise per toss peaks at one bit for a fair coin and falls as the coin leans to one side.',
      misconception: 'A biased coin is more surprising because its tosses are harder to call.',
    },
  ],
});

const COIN_ARTICLE = 'How surprising is a coin?';

/** Where the coin prediction takes its answer from, so the tools withhold it until the reader commits. */
const coinAnswers: AnswerSources = { 'fair-bits': 'entropy' };

const coinScript = [
  { id: 'place', label: 'Where is the reader?', tool: 'read_place', input: {} },
  { id: 'chance', label: 'Set the chance to 0.25', tool: 'set_param', input: { name: 'heads', value: 0.25 } },
  { id: 'play', label: 'Play the chance', tool: 'play', input: { name: 'heads' } },
  { id: 'pause', label: 'Pause', tool: 'pause', input: {} },
  { id: 'inspect', label: 'Inspect heads', tool: 'inspect_figure', input: { figure: 'Coin outcomes', id: 'heads' } },
] as const satisfies ReadonlyArray<ScriptCall>;

function isLowSurprise(values: Readonly<Record<string, unknown>>): boolean {
  return Number(values['entropy']) < LOW_SURPRISE;
}

const styles = stylex.create({
  page: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
    gap: spacing.xl,
    alignItems: 'start',
    maxWidth: 1120,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  column: { display: 'grid', gap: spacing.lg, minWidth: 0 },
  heading: { margin: 0, fontSize: typography.compactHeadingSize, lineHeight: typography.compactHeadingLineHeight },
  subheading: { margin: 0, fontSize: typography.bodySize, fontWeight: typography.strongWeight },
  prose: { margin: 0, maxWidth: '62ch', fontSize: typography.sectionSize, lineHeight: typography.proseLineHeight },
  meta: { margin: 0, color: colors.muted, fontSize: typography.captionSize },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm },
  panel: {
    display: 'grid',
    gap: spacing.md,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
  },
  output: {
    margin: 0,
    padding: spacing.md,
    maxHeight: 240,
    overflow: 'auto',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    fontSize: typography.captionSize,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  line: { margin: 0, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
});

function LossChart(): ReactNode {
  const { values, locale } = useLesson(training);

  return (
    <BarChart
      title="Loss by epoch"
      description="Synthetic training loss at five epochs for the current learning rate and schedule."
      locale={locale}
      categories={EPOCHS.map((epoch) => ({ id: `e${epoch}`, label: `Epoch ${epoch}` }))}
      series={[
        { id: 'loss', label: 'Loss', tone: 'series1', values: EPOCHS.map((epoch) => lossAt({ ...values, epoch })) },
      ]}
      domain={[0, 3]}
      valueFormat={{ maximumFractionDigits: 2 }}
      valueLabel="Loss"
      height="compact"
    />
  );
}

function TrainingEssay(): ReactNode {
  const { beat, step } = useLesson(training);
  const title = training.beats.find((item) => item.id === beat)?.title ?? 'No beat';

  return (
    <div {...stylex.props(styles.column)}>
      <h2 {...stylex.props(styles.heading)}>How the learning rate shapes training</h2>
      <p aria-label="Reader place" {...stylex.props(styles.meta)}>
        {`Beat: ${title}. Reveal step ${step}.`}
      </p>
      <p {...stylex.props(styles.prose)}>
        With a learning rate of <Param name="learningRate" /> and a <Param name="schedule" /> schedule, the training
        loss after <Value name="epoch" /> epochs is <Value name="loss" />.
      </p>
      <LossChart />
      <ParamSlider name="learningRate" />
      <ParamChoice name="schedule" />
      <Playback name="epoch" from={0} pace="fast" />
      <Transport for="epoch" />
    </div>
  );
}

function eventLine(event: LearnerRecord['events'][number]): string {
  const seconds = (event.at / 1000).toFixed(1);

  const verdict =
    event.answer === undefined ? '' : ` answer ${String(event.answer)}, right: ${String(event.isCorrect)}`;

  return `${seconds} s  ${event.kind} ${event.name}: ${String(event.from)} → ${String(event.to)}${verdict} (${event.source}, ×${event.count})`;
}

/** Records the reader through the bridge, and reads the record again on every event. */
function useTrace({
  agent,
  lesson,
  article,
}: {
  readonly agent: LessonAgent;
  readonly lesson: AnyLesson;
  readonly article?: string | undefined;
}): { readonly record: LearnerRecord | null; readonly clear: () => void } {
  const [record, setRecord] = useState<LearnerRecord | null>(null);
  const trace = useRef<ReturnType<typeof createLearnerTrace> | null>(null);

  useEffect(() => {
    const created = createLearnerTrace({ agent, lesson, article });
    const stop = created.subscribe(() => setRecord(created.read()));

    trace.current = created;

    return () => {
      stop();
      created.stop();
    };
  }, [agent, lesson, article]);

  return { record, clear: () => trace.current?.clear() };
}

const BRIDGE_COMPONENTS: ReadonlySet<string> = new Set(['lesson', 'lesson-progress']);

function TutorPanel({
  agent,
  lesson,
  calls,
  tutorTour,
  article,
  answers,
}: {
  readonly agent: LessonAgent;
  readonly lesson: AnyLesson;
  readonly calls: ReadonlyArray<ScriptCall>;
  readonly tutorTour?: LessonTour | undefined;
  readonly article?: string | undefined;
  readonly answers?: AnswerSources | undefined;
}): ReactNode {
  const tools = tutorTools({ agent, lesson, locale: 'en-US', article, answers });
  const [result, setResult] = useState('Press a tool to run it as the tutor would.');
  const { record, clear } = useTrace({ agent, lesson, article });
  const [player, setPlayer] = useState<TourPlayer | null>(null);
  const [tourText, setTourText] = useState('The tour has not started.');
  const [said, setSaid] = useState('');
  const findings = tutorTour === undefined ? [] : validateTour(tutorTour, lesson);
  const [log, setLog] = useState<ReadonlyArray<string>>([]);

  useEffect(() => () => player?.stop(), [player]);

  useEffect(
    () =>
      agent.subscribe((change) => {
        if (BRIDGE_COMPONENTS.has(change.component)) {
          setLog((lines) => [`${change.key} changed by ${change.source} (${change.reason})`, ...lines].slice(0, 6));
        }
      }),
    [agent],
  );

  async function run(tool: string, input: unknown): Promise<void> {
    const found = tools.find((item) => item.name === tool);

    setResult(found === undefined ? `No tool ${tool}.` : JSON.stringify(await found.run(input), null, 2));
  }

  function startTour(steps: LessonTour): void {
    player?.stop();

    const next = playTour({ agent, lesson, tour: steps, onSay: (line) => setSaid(line) });

    next.subscribe(() => setTourText(`Tour ${next.status()} at step ${next.index() + 1} of ${steps.length}.`));
    setTourText(`Tour ${next.status()} at step ${next.index() + 1} of ${steps.length}.`);
    setPlayer(next);
  }

  return (
    <div {...stylex.props(styles.column)}>
      <section aria-label="Scripted tutor" {...stylex.props(styles.panel)}>
        <h3 {...stylex.props(styles.subheading)}>Scripted tutor</h3>
        <div {...stylex.props(styles.buttons)}>
          {calls.map((call) => (
            <Button
              key={call.id}
              variant="outline"
              onClick={async () => {
                await run(call.tool, call.input);
              }}
            >
              {call.label}
            </Button>
          ))}
        </div>
        <pre aria-label="Tool result" {...stylex.props(styles.output)}>
          {result}
        </pre>
        <pre aria-label="Bridge log" {...stylex.props(styles.output)}>
          {log.length === 0 ? 'Every lesson change the bridge reports, with its source, appears here.' : log.join('\n')}
        </pre>
      </section>
      <section aria-label="Learner trace" {...stylex.props(styles.panel)}>
        <h3 {...stylex.props(styles.subheading)}>What the reader did</h3>
        <p aria-label="Trace summary" {...stylex.props(styles.line)}>
          {record === null
            ? 'The reader has not acted yet.'
            : summarizeTrace({ record, lesson, locale: 'en-US', answers })}
        </p>
        <pre aria-label="Trace events" {...stylex.props(styles.output)}>
          {record === null || record.events.length === 0
            ? 'No reader events yet. Agent changes never appear here.'
            : record.events.map(eventLine).join('\n')}
        </pre>
        <div {...stylex.props(styles.buttons)}>
          <Button variant="outline" onClick={clear}>
            Clear the trace
          </Button>
          <Button
            variant="outline"
            onClick={() => setResult(JSON.stringify(record === null ? [] : tourFromTrace(record), null, 2))}
          >
            Make a tour from the trace
          </Button>
        </div>
      </section>
      {tutorTour === undefined ? null : (
        <section aria-label="Tour" {...stylex.props(styles.panel)}>
          <h3 {...stylex.props(styles.subheading)}>Tour</h3>
          <p aria-label="Tour check" {...stylex.props(styles.meta)}>
            {findings.length === 0 ? 'validateTour found nothing.' : findings.map((item) => item.message).join(' ')}
          </p>
          <div {...stylex.props(styles.buttons)}>
            <Button variant="outline" onClick={() => startTour(tutorTour)}>
              Play the tour
            </Button>
            <Button variant="outline" onClick={() => player?.resume()}>
              Resume
            </Button>
            <Button variant="outline" onClick={() => player?.stop()}>
              Stop
            </Button>
          </div>
          <p aria-label="Tour status" {...stylex.props(styles.meta)}>
            {tourText}
          </p>
          <p aria-label="Tutor line" {...stylex.props(styles.line)}>
            {said === '' ? 'The tutor has said nothing yet.' : said}
          </p>
        </section>
      )}
    </div>
  );
}

function TutorStory(): ReactNode {
  const [agent] = useState(() => createAgent());

  return (
    <div {...stylex.props(styles.page)}>
      <Lesson lesson={training} locale="en-US">
        <TrainingEssay />
      </Lesson>
      <TutorPanel agent={agent} lesson={training} calls={script} tutorTour={tour} />
    </div>
  );
}

export const Default: Story = { render: () => <TutorStory /> };

function CoinFigure(): ReactNode {
  const { values } = useLesson(coin);
  const { heads } = values;

  return (
    <Scene
      title="Coin outcomes"
      description="The two outcomes of one toss, sized by their chance."
      x={[0, 4]}
      y={[0, 2]}
      height="compact"
    >
      <SceneNode
        id="heads"
        at={[1, 1]}
        shape="circle"
        text="H"
        label={`Heads, chance ${heads.toFixed(2)}`}
        tone="series1"
      />
      <SceneNode
        id="tails"
        at={[3, 1]}
        shape="circle"
        text="T"
        label={`Tails, chance ${(1 - heads).toFixed(2)}`}
        tone="series2"
      />
    </Scene>
  );
}

function CoinArticleStory(): ReactNode {
  const [agent] = useState(() => createAgent());

  return (
    <div {...stylex.props(styles.page)}>
      <Article lesson={coin} locale="en-US" title={COIN_ARTICLE}>
        <Beat id="toss">
          <p>
            This coin lands heads with a chance of <Param name="heads" />. How surprised should you be by one toss?
          </p>
          <Predict
            id="fair-bits"
            prompt="At this chance of heads, how many bits of surprise does one toss carry?"
            min={0}
            max={2}
            step={0.05}
            format={{ style: 'unit', unit: 'bit', maximumFractionDigits: 2 }}
            answerFrom="entropy"
            tolerance={0.15}
          >
            <p>A fair coin carries one bit: each toss settles one yes-or-no question.</p>
          </Predict>
          <Figure
            id="outcomes"
            caption="Heads and tails at the current chance."
            description="Two outcomes of one toss."
            reads={['heads']}
          >
            <CoinFigure />
          </Figure>
          <ParamSlider name="heads" />
          <Playback name="heads" pace="fast" />
          <Transport for="heads" />
          <Challenge
            id="low-surprise"
            prompt="Make one toss carry less than half a bit."
            isReached={isLowSurprise}
            hints={['Lean the coin toward one side.', 'Try a chance of heads below 0.1 or above 0.9.']}
          >
            <p>
              One toss now carries <Value name="entropy" />. The nearer a coin is to certain, the less one toss tells
              you.
            </p>
          </Challenge>
        </Beat>
      </Article>
      <TutorPanel agent={agent} lesson={coin} calls={coinScript} article={COIN_ARTICLE} answers={coinAnswers} />
    </div>
  );
}

export const WithArticle: Story = { render: () => <CoinArticleStory /> };

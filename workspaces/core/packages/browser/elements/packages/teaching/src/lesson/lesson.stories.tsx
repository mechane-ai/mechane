import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart } from '../../../charts/src/cartesian/index.ts';
import { Button } from '../../../core/src/index.ts';
import { createAgent } from '../../../foundations/src/agent/index.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from './define-lesson.ts';
import { Lesson } from './lesson.tsx';
import { ParamChoice, ParamSlider, ParamToggle } from './param-controls.tsx';
import { Param, Value } from './param.tsx';
import { Playback } from './playback.tsx';
import { Transport } from './transport.tsx';
import { useLesson } from './use-lesson.ts';

const meta = {
  title: 'Teaching/Lesson',
  component: Lesson,
  parameters: {
    docs: {
      description: {
        component:
          'Lesson holds one explainer’s state, declared once with defineLesson: params with ranges and formats, values derived from them, and beats. Prose (Param, Value), block controls, figures, players and agents all read and set the same names, so they never disagree. The author supplies the definition and the locale; the application may hold the values, the beat and the step itself.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Synthetic next-token scores for "The ___ sat on the mat", before training sharpens them. */
const tokens = [
  { id: 'cat', label: 'cat', logit: 2.4 },
  { id: 'dog', label: 'dog', logit: 1.9 },
  { id: 'car', label: 'car', logit: 0.6 },
  { id: 'sun', label: 'sun', logit: -0.4 },
] as const;

const LAST_STEP = 30;
const SHARPENING = 1.5;

function total(values: ReadonlyArray<number>): number {
  const sum = { value: 0 };

  for (const value of values) {
    sum.value += value;
  }

  return sum.value;
}

/** The softmax of each token's score, scaled by training and divided by the temperature. */
function distribution({
  temperature,
  trainStep,
  isTopTwo,
}: {
  readonly temperature: number;
  readonly trainStep: number;
  readonly isTopTwo: boolean;
}): ReadonlyArray<number> {
  const scale = 1 + (SHARPENING * trainStep) / LAST_STEP;

  const weights = tokens.map((token, index) =>
    isTopTwo && index > 1 ? 0 : Math.exp((token.logit * scale) / temperature),
  );

  const sum = total(weights);

  return weights.map((weight) => weight / sum);
}

const softmax = defineLesson({
  id: 'softmax',
  title: 'How temperature reshapes a softmax',
  params: {
    temperature: {
      kind: 'number',
      label: 'Temperature',
      value: 1,
      min: 0.1,
      max: 10,
      step: 0.01,
      scale: 'log',
      format: { maximumFractionDigits: 2 },
    },
    token: {
      kind: 'choice',
      label: 'Followed token',
      value: 'cat',
      options: tokens.map(({ id, label }) => ({ id, label })),
    },
    isTopTwo: { kind: 'toggle', label: 'Keep only the top two tokens', value: false },
    trainStep: {
      kind: 'number',
      label: 'Training step',
      value: 0,
      min: 0,
      max: LAST_STEP,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    probability: {
      label: 'Probability of the followed token',
      format: { style: 'percent', maximumFractionDigits: 1 },
      from: (values) => distribution(values)[tokens.findIndex((token) => token.id === values.token)] ?? 0,
    },
    entropy: {
      label: 'Entropy',
      format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 },
      from: (values) => -total(distribution(values).map((share) => (share > 0 ? share * Math.log2(share) : 0))),
    },
  },
  beats: [
    {
      id: 'scores',
      title: 'Scores become probabilities',
      states: [{ id: 'cold', label: 'Cold', values: { temperature: 0.3 } }],
    },
    { id: 'training', title: 'Training sharpens the scores', steps: 1 },
  ],
});

const styles = stylex.create({
  essay: {
    display: 'grid',
    gap: spacing.lg,
    maxWidth: 760,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  title: { margin: 0, fontSize: typography.compactHeadingSize, lineHeight: typography.compactHeadingLineHeight },
  text: {
    margin: 0,
    maxWidth: '66ch',
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
  controls: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
    gap: spacing.lg,
    alignItems: 'start',
  },
  pair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: spacing.xl },
  card: {
    display: 'grid',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
  },
  log: {
    margin: 0,
    padding: spacing.md,
    maxHeight: 280,
    overflow: 'auto',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    fontSize: typography.captionSize,
    whiteSpace: 'pre-wrap',
  },
});

/** The bar chart every story here shares: it reads the lesson's values like the prose does. */
function TokenChart(): ReactNode {
  const { values, locale } = useLesson(softmax);
  const shares = distribution(values);

  return (
    <BarChart
      title="Next-token probabilities"
      description="Synthetic scores for four candidate tokens after the softmax."
      locale={locale}
      categories={tokens.map(({ id, label }) => ({ id, label }))}
      series={[{ id: 'probability', label: 'Probability', tone: 'series1', values: shares }]}
      domain={[0, 1]}
      valueFormat={{ style: 'percent', maximumFractionDigits: 1 }}
      valueLabel="Probability"
      emphasizedCategoryIds={[values.token]}
      height="compact"
    />
  );
}

function SoftmaxEssay(): ReactNode {
  return (
    <article {...stylex.props(styles.essay)}>
      <h2 {...stylex.props(styles.title)}>How temperature reshapes a softmax</h2>
      <p {...stylex.props(styles.text)}>
        A model scores four next tokens for “The ___ sat on the mat” (synthetic scores). Divide every score by a
        temperature of <Param name="temperature" /> before the softmax, and <Param name="token" /> gets{' '}
        <Value name="probability" /> of the probability. The whole distribution carries <Value name="entropy" /> of
        entropy. Keep only the top two tokens: <Param name="isTopTwo" />.
      </p>
      <TokenChart />
      <div {...stylex.props(styles.controls)}>
        <ParamSlider name="temperature" />
        <ParamChoice name="token" />
        <ParamToggle name="isTopTwo" />
      </div>
      <p {...stylex.props(styles.text)}>
        Training sharpens the scores. At training step <Value name="trainStep" />, the followed token gets{' '}
        <Value name="probability" />. Play the training run and watch the bars and the sentence move together.
      </p>
      <Playback name="trainStep" pace="regular" />
      <Transport for="trainStep" />
    </article>
  );
}

export const Default: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US">
      <SoftmaxEssay />
    </Lesson>
  ),
};

/** Logs each change's reason and source, and refuses temperatures above 5 while the lock is on. */
function ControlledLesson(): ReactNode {
  const [values, setValues] = useState<Partial<typeof softmax.defaults>>({ temperature: 0.5 });
  const [isLocked, setIsLocked] = useState(true);
  const [log, setLog] = useState<ReadonlyArray<string>>([]);

  return (
    <div {...stylex.props(styles.essay)}>
      <Lesson
        lesson={softmax}
        locale="en-US"
        values={values}
        onValuesChange={(next, details) => {
          const isRefused = isLocked && next.temperature > 5;

          if (isRefused) {
            details.cancel();
          } else {
            setValues(next);
          }

          setLog((lines) =>
            [`${details.reason} from ${details.source}${isRefused ? ', refused' : ''}`, ...lines].slice(0, 8),
          );
        }}
      >
        <p {...stylex.props(styles.text)}>
          The application holds the values. A temperature of <Param name="temperature" /> gives the followed token{' '}
          <Value name="probability" />.
        </p>
        <ParamSlider name="temperature" />
      </Lesson>
      <Button variant="outline" onClick={() => setIsLocked((locked) => !locked)}>
        {isLocked ? 'Allow temperatures above 5' : 'Refuse temperatures above 5'}
      </Button>
      <pre aria-label="Change log" {...stylex.props(styles.log)}>
        {log.length === 0 ? 'No changes yet.' : log.join('\n')}
      </pre>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledLesson /> };

export const UnknownNames: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US">
      <div {...stylex.props(styles.essay)}>
        <p {...stylex.props(styles.text)}>
          A misspelled param: <Param name="temprature" /> A value the lesson never derives: <Value name="loss" />
        </p>
        <ParamSlider name="token" />
        <Transport for="steps" />
      </div>
    </Lesson>
  ),
};

export const SyncedWithAddress: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US" shouldSyncUrl>
      <div {...stylex.props(styles.essay)}>
        <p {...stylex.props(styles.text)}>
          This lesson writes its values to the address bar as <code>softmax.temperature=…</code>, so a link opens it
          where the reader left it. A temperature of <Param name="temperature" /> leaves <Value name="entropy" /> of
          entropy.
        </p>
        <ParamSlider name="temperature" />
      </div>
    </Lesson>
  ),
};

export const TwoLessons: Story = {
  render: () => (
    <div {...stylex.props(styles.pair)}>
      {['Left', 'Right'].map((side) => (
        <section key={side} aria-label={`${side} copy`} {...stylex.props(styles.card)}>
          <Lesson lesson={softmax} locale="en-US" defaultValues={{ temperature: side === 'Left' ? 0.5 : 2 }}>
            <p {...stylex.props(styles.text)}>
              {side}: at <Param name="temperature" /> the followed token gets <Value name="probability" />.
            </p>
            <ParamSlider name="temperature" />
          </Lesson>
        </section>
      ))}
    </div>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US" values={{ temperature: 0.3, isTopTwo: true }} isReadOnly>
      <SoftmaxEssay />
    </Lesson>
  ),
};

/** Mounts the UI SDK agent bridge, shows what it reads, and sends the step an agent would send. */
function AgentPanel(): ReactNode {
  const [agent] = useState(() => createAgent());
  const [text, setText] = useState('Press a button to see what an agent reads or does.');

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.controls)}>
        <Button
          variant="outline"
          onClick={() =>
            setText(
              JSON.stringify(
                agent.snapshot().filter((entry) => entry.component === 'lesson'),
                null,
                2,
              ),
            )
          }
        >
          Read the lesson as an agent
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const result = await agent.act({
              steps: [{ ref: softmax.title, action: 'setParam', args: ['temperature', 2] }],
            });

            setText(JSON.stringify(result, null, 2));
          }}
        >
          Ask the agent for temperature 2
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const result = await agent.act({ steps: [{ ref: softmax.title, action: 'play', args: ['trainStep'] }] });

            setText(JSON.stringify(result, null, 2));
          }}
        >
          Ask the agent to play the training run
        </Button>
      </div>
      <pre aria-label="Agent output" {...stylex.props(styles.log)}>
        {text}
      </pre>
    </div>
  );
}

/** A lesson an agent reads and moves, with a log of who started each player and who moved each value. */
function AgentLesson(): ReactNode {
  const [log, setLog] = useState<ReadonlyArray<string>>([]);

  return (
    <div {...stylex.props(styles.essay)}>
      <Lesson
        lesson={softmax}
        locale="en-US"
        onValuesChange={(_values, details) =>
          setLog((lines) => [`values: ${details.reason} from ${details.source}`, ...lines].slice(0, 8))
        }
        onPlayingChange={(playing, details) =>
          setLog((lines) =>
            [`playing ${playing ?? 'stopped'}: ${details.reason} from ${details.source}`, ...lines].slice(0, 8),
          )
        }
      >
        <p {...stylex.props(styles.text)}>
          A temperature of <Param name="temperature" /> gives the followed token <Value name="probability" /> at
          training step <Value name="trainStep" />.
        </p>
        <TokenChart />
        <Playback name="trainStep" pace="fast" />
        <Transport for="trainStep" />
      </Lesson>
      <AgentPanel />
      <pre aria-label="Change log" {...stylex.props(styles.log)}>
        {log.length === 0 ? 'No changes yet.' : log.join('\n')}
      </pre>
    </div>
  );
}

export const WithAgent: Story = { render: () => <AgentLesson /> };

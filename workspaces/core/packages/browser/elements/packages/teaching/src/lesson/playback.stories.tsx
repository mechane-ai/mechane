import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { CurveChart } from '../../../charts/src/trend/index.ts';
import { Button, Row } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from './define-lesson.ts';
import { Lesson } from './lesson.tsx';
import { Value } from './param.tsx';
import { Playback, usePlayback } from './playback.tsx';
import { Transport } from './transport.tsx';
import { useLesson } from './use-lesson.ts';

const meta = {
  title: 'Teaching/Playback',
  component: Playback,
  subcomponents: { Transport },
  parameters: {
    docs: {
      description: {
        component:
          'Playback drives a number param over time, one step at a time on the shared clock, and renders nothing. Transport is its play, pause, step and scrub row; usePlayback builds other controls. It pauses when the tab is hidden or the reader changes the value, and with reduced motion play shows the end at once.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const STEPS = 2000;
const STEP_SIZE = 50;
const SAMPLES = Array.from({ length: STEPS / STEP_SIZE + 1 }, (_, index) => index * STEP_SIZE);

/** A closed-form synthetic loss: an irreducible floor plus a power law in the step. */
function loss(step: number): number {
  return 1.7 + 2.3 * (1 + step / 100) ** -0.6;
}

const training = defineLesson({
  id: 'training-run',
  title: 'Watch a training run',
  params: {
    trainStep: {
      kind: 'number',
      label: 'Training step',
      value: 0,
      min: 0,
      max: STEPS,
      step: STEP_SIZE,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    loss: { label: 'Validation loss', format: { maximumFractionDigits: 2 }, from: (values) => loss(values.trainStep) },
  },
});

const styles = stylex.create({
  column: { display: 'grid', gap: spacing.lg, maxWidth: 720, minWidth: 0, color: colors.ink },
  sentence: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
});

/** The loss so far: the curve grows as the run plays. */
function LossSoFar(): ReactNode {
  const { values, locale } = useLesson(training);
  const seen = SAMPLES.filter((step) => step <= values.trainStep);

  return (
    <CurveChart
      title="Validation loss so far"
      description="A synthetic power-law loss, drawn up to the current training step."
      locale={locale}
      series={[{ id: 'run', label: 'Run', points: seen.map((step) => ({ x: step, y: loss(step) })) }]}
      x={{ label: 'Training step', domain: [0, STEPS], format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Loss (nats)', domain: [1.5, 4.2], format: { maximumFractionDigits: 2 } }}
      height="compact"
    />
  );
}

function Run({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <Lesson lesson={training} locale="en-US">
      <div {...stylex.props(styles.column)}>
        <p {...stylex.props(styles.sentence)}>
          At step <Value name="trainStep" /> the validation loss is <Value name="loss" />.
        </p>
        <LossSoFar />
        {children}
      </div>
    </Lesson>
  );
}

export const Default: Story = {
  render: () => (
    <Run>
      <Playback name="trainStep" pace="regular" />
      <Transport for="trainStep" />
    </Run>
  ),
};

export const LoopingPart: Story = {
  render: () => (
    <Run>
      <Playback name="trainStep" from={500} to={1500} pace="fast" isLooping />
      <Transport
        for="trainStep"
        labels={{ play: 'Loop steps 500 to 1,500', pause: 'Stop the loop', scrub: 'Training step, 500 to 1,500' }}
      />
    </Run>
  ),
};

/** Custom controls from the hook: the same player, with buttons the author writes. */
function HookButtons(): ReactNode {
  const player = usePlayback('trainStep');

  return (
    <Row>
      <Button variant="outline" onClick={() => player.toggle()}>
        {player.isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Button variant="ghost" onClick={() => player.seek(0)}>
        Back to step 0
      </Button>
      <Button variant="ghost" onClick={() => player.stepBy(4)}>
        Skip 4 steps
      </Button>
    </Row>
  );
}

export const WithHook: Story = {
  render: () => (
    <Run>
      <Playback name="trainStep" pace="slow" />
      <HookButtons />
    </Run>
  ),
};

/** A timed run: the whole range in the `short` two seconds, starting fast and settling, on the shared clock. */
export const TimedRun: Story = {
  render: () => (
    <Run>
      <Playback name="trainStep" pace={{ run: 'short', isEased: true }} />
      <Transport for="trainStep" />
    </Run>
  ),
};

export const InvalidRange: Story = {
  render: () => (
    <Run>
      <Playback name="trainStep" from={1500} to={500} />
      <Playback name="learningRate" />
    </Run>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '../../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from '../../lesson/define-lesson.ts';
import { Lesson } from '../../lesson/lesson.tsx';
import { ParamSlider } from '../../lesson/param-controls.tsx';
import { Value } from '../../lesson/param.tsx';
import { Playback } from '../../lesson/playback.tsx';
import { Transport } from '../../lesson/transport.tsx';
import { useLesson } from '../../lesson/use-lesson.ts';
import { SceneCallout } from '../scene-callout.tsx';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneNode } from '../scene-node.tsx';
import { SceneWire } from '../scene-wire.tsx';
import { Scene } from '../scene.tsx';
import { SceneAxes } from './scene-axes.tsx';
import { SceneCurve } from './scene-curve.tsx';
import { ScenePoint } from './scene-point.tsx';
import { SceneProjection } from './scene-projection.tsx';
import { SceneRegion } from './scene-region.tsx';
import { SceneRule } from './scene-rule.tsx';
import { SceneVector } from './scene-vector.tsx';

const NARROW_WIDTH = 320;
const STORY_GAP = 24;

const styles = stylex.create({
  list: { display: 'grid', gap: STORY_GAP },
  narrow: { width: NARROW_WIDTH },
  column: { display: 'grid', gap: spacing.lg, maxWidth: 720, minWidth: 0, color: colors.ink },
  sentence: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
});

const meta = {
  title: 'Teaching/ScenePlane',
  component: Scene,
  subcomponents: { SceneAxes, SceneCurve, ScenePoint, SceneVector, SceneRegion, SceneRule, SceneProjection },
  parameters: {
    docs: {
      description: {
        component:
          'The parts a math explanation draws inside a Scene, all on the plot kernel. SceneAxes draws the ticks, titles and grid of the data box and follows the camera. SceneCurve draws points or a function and eases from the old shape to the new one. ScenePoint marks a position and, with sets or onMove, is a slider: a pointer drags it, and Tab reaches it for the arrow keys, Home and End. SceneVector is an arrow whose ends ease. SceneRegion is a pale wash for a zone. SceneRule is a dashed threshold or asymptote with a short label. SceneProjection drops dashed lines from a point to the axes and writes its values there. Every part takes a stable id, a tone and an optional label that makes it a keyboard item; the author supplies states, never animations.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

const probe = defineLesson({
  id: 'probe',
  title: 'A point on the sigmoid',
  params: {
    z: {
      kind: 'number',
      label: 'Input z',
      value: 1.2,
      min: -6,
      max: 6,
      step: 0.05,
      format: { maximumFractionDigits: 2 },
    },
  },
  derived: {
    output: { label: 'Output σ(z)', format: { maximumFractionDigits: 2 }, from: (values) => sigmoid(values.z) },
  },
});

function SigmoidScene(): ReactNode {
  const { values } = useLesson(probe);
  const position: ScenePosition = [values.z, values.output];
  const [across, up] = position;
  const slope = up * (1 - up);

  return (
    <Scene
      title="Grab the point on the sigmoid"
      description="Synthetic function σ(z) = 1 / (1 + e^−z). Drag the point, or Tab to it and use the arrow keys. The arrow is the tangent, and the dashed lines read the point's values off the axes."
      locale="en-US"
      x={[-6, 6]}
      y={[0, 1]}
    >
      <SceneAxes x={{ label: 'Input z' }} y={{ label: 'Output σ(z)' }} grid="both" />
      <SceneRegion id="positive" above={0.5} tone="positive" text="Positive" />
      <SceneRule id="threshold" y={0.5} text="Threshold" />
      <SceneCurve
        id="sigmoid"
        of={sigmoid}
        resolution="fine"
        label="The sigmoid curve, rising from 0 at the far left to 1 at the far right"
      />
      <SceneVector
        id="tangent"
        from={position}
        to={[across + 1, up + slope]}
        text="slope"
        label={`Tangent at z = ${across.toFixed(2)}, slope ${slope.toFixed(2)}`}
      />
      <ScenePoint
        id="probe"
        at={position}
        along={sigmoid}
        sets={{ x: 'z' }}
        label={`Point at z = ${across.toFixed(2)}, σ(z) = ${up.toFixed(2)}.`}
      />
      <SceneProjection id="drop" of="probe" />
    </Scene>
  );
}

/** The point writes the lesson's `z`; the sentence, the tangent and the projection read it back. */
function SigmoidLesson(): ReactNode {
  return (
    <Lesson lesson={probe} locale="en-US">
      <div {...stylex.props(styles.column)}>
        <p {...stylex.props(styles.sentence)}>
          At z = <Value name="z" /> the sigmoid gives <Value name="output" />.
        </p>
        <SigmoidScene />
      </div>
    </Lesson>
  );
}

export const Default: Story = { render: () => <SigmoidLesson /> };

function tanh(value: number): number {
  return Math.tanh(value);
}

function clippedRamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const activations = [
  { id: 'sigmoid', label: 'Sigmoid', of: sigmoid, threshold: 0.5, active: [-2, 2] },
  { id: 'tanh', label: 'Tanh', of: tanh, threshold: 0, active: [-1, 1] },
  { id: 'ramp', label: 'Clipped ramp', of: clippedRamp, threshold: 0.5, active: [0, 1] },
] as const;

const PROBE_AT = 0.8;

function ActivationScene(): ReactNode {
  const [activationId, setActivationId] = useState('sigmoid');
  const activation = activations.find((candidate) => candidate.id === activationId) ?? activations[0];
  const height = activation.of(PROBE_AT);

  return (
    <Scene
      title="Three activation functions"
      description="Synthetic textbook functions. Each step changes props only: the curve morphs, the zone, threshold and point follow."
      locale="en-US"
      x={[-4, 4]}
      y={[-1.2, 1.2]}
      pace="slow"
      actions={
        <SegmentedControl.Root value={activationId} onValueChange={setActivationId} aria-label="Activation function">
          {activations.map((candidate) => (
            <SegmentedControl.Item key={candidate.id} value={candidate.id}>
              {candidate.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      }
    >
      <SceneAxes x={{ label: 'Input' }} y={{ label: 'Activation' }} />
      <SceneRegion
        id="active"
        between={activation.active}
        tone="series2"
        text="Steep part"
        label={`The steep part runs from ${activation.active[0]} to ${activation.active[1]}`}
      />
      <SceneRule id="threshold" y={activation.threshold} text="Midpoint" />
      <SceneCurve
        id="activation"
        of={activation.of}
        resolution="fine"
        thickness="thick"
        label={`The ${activation.label.toLowerCase()} curve`}
      />
      <ScenePoint
        id="probe"
        at={[PROBE_AT, height]}
        text={`f(${PROBE_AT}) = ${height.toFixed(2)}`}
        label={`The ${activation.label.toLowerCase()} at ${PROBE_AT} is ${height.toFixed(2)}`}
      />
    </Scene>
  );
}

export const Stepped: Story = { render: () => <ActivationScene /> };

const slopeAndBias = defineLesson({
  id: 'line',
  title: 'A slope and a bias',
  params: {
    slope: {
      kind: 'number',
      label: 'Slope',
      value: 0.5,
      min: -2,
      max: 2,
      step: 0.25,
      format: { maximumFractionDigits: 2 },
    },
    bias: { kind: 'number', label: 'Bias', value: 1, min: -2, max: 2, step: 0.5, format: { maximumFractionDigits: 1 } },
  },
});

function SlopeBiasScene(): ReactNode {
  const { values } = useLesson(slopeAndBias);

  return (
    <Scene
      title="One point, two params"
      description="Synthetic params. The point's x is the slope and its y the bias; the dashed lines read both off the axes."
      locale="en-US"
      x={[-2, 2]}
      y={[-2, 2]}
    >
      <SceneAxes x={{ label: 'Slope' }} y={{ label: 'Bias' }} grid="both" />
      <ScenePoint
        id="params"
        at={[values.slope, values.bias]}
        sets={{ x: 'slope', y: 'bias' }}
        tone="series2"
        label="The slope and the bias"
      />
      <SceneProjection id="read" of="params" />
    </Scene>
  );
}

export const TwoParams: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A point that sets two params is one slider for both. Tab reaches it; Left and Right step the slope, Up and Down the bias, Home and End take the slope to its ends, and Page Up and Down take ten bias steps. It speaks both values, each in its param’s format.',
      },
    },
  },
  render: () => (
    <Lesson lesson={slopeAndBias} locale="en-US">
      <div {...stylex.props(styles.column)}>
        <p {...stylex.props(styles.sentence)}>
          Slope <Value name="slope" />, bias <Value name="bias" />.
        </p>
        <SlopeBiasScene />
      </div>
    </Lesson>
  ),
};

const START = -1.6;
const LAST_STEP = 8;
const FLOOR = 0.3;

function loss(weight: number): number {
  return 0.5 * (weight - 1) ** 2 + FLOOR;
}

/** Gradient descent on the quadratic loss, in closed form: each step keeps (1 − rate) of the distance to 1. */
function weightAt(step: number, rate: number): number {
  return 1 + (START - 1) * (1 - rate) ** step;
}

const descent = defineLesson({
  id: 'descent',
  title: 'Gradient descent on a loss curve',
  params: {
    step: {
      kind: 'number',
      label: 'Step',
      value: 0,
      min: 0,
      max: LAST_STEP,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
    rate: {
      kind: 'number',
      label: 'Learning rate',
      value: 0.3,
      min: 0.05,
      max: 0.9,
      step: 0.05,
      format: { maximumFractionDigits: 2 },
    },
  },
  derived: {
    weight: {
      label: 'Weight',
      format: { maximumFractionDigits: 2 },
      from: (values) => weightAt(values.step, values.rate),
    },
    next: {
      label: 'Next weight',
      format: { maximumFractionDigits: 2 },
      from: (values) => weightAt(values.step + 1, values.rate),
    },
    loss: { label: 'Loss', format: { maximumFractionDigits: 2 }, from: (values) => loss(values.weight) },
  },
});

const trail = Array.from({ length: LAST_STEP }, (_, step) => step);

function DescentScene(): ReactNode {
  const { values } = useLesson(descent);
  const here: ScenePosition = [values.weight, values.loss];

  return (
    <Scene
      title="Walking downhill"
      description="Synthetic loss L(w) = ½(w − 1)² + 0.3. Each step moves the weight against the slope by the learning rate times the slope; the arrow is that step."
      locale="en-US"
      x={[-2, 4]}
      y={[0, 5]}
      pace="slow"
    >
      <SceneAxes x={{ label: 'Weight w' }} y={{ label: 'Loss' }} />
      <SceneCurve id="loss" of={loss} resolution="fine" label="The loss curve, lowest at a weight of 1" />
      <SceneRule id="best" x={1} text="Lowest loss" />
      {trail.map((step) => (
        <ScenePoint
          key={step}
          id={`trail-${step}`}
          at={[weightAt(step, values.rate), loss(weightAt(step, values.rate))]}
          tone="neutral"
          emphasis="context"
          isShown={step < values.step}
        />
      ))}
      <SceneVector
        id="step"
        from={here}
        to={[values.next, values.loss]}
        isShown={Math.abs(values.next - values.weight) > 0.03}
        label={`The next step moves the weight from ${values.weight.toFixed(2)} to ${values.next.toFixed(2)}`}
      />
      <ScenePoint
        id="walker"
        at={here}
        label={`Weight ${values.weight.toFixed(2)}, loss ${values.loss.toFixed(2)}`}
        text={values.loss.toFixed(2)}
      />
    </Scene>
  );
}

export const GradientDescent: Story = {
  render: () => (
    <Lesson lesson={descent} locale="en-US">
      <div {...stylex.props(styles.column)}>
        <p {...stylex.props(styles.sentence)}>
          At step <Value name="step" /> the weight is <Value name="weight" /> and the loss is <Value name="loss" />.
        </p>
        <DescentScene />
        <Playback name="step" pace="slow" />
        <Transport for="step" />
        <ParamSlider name="rate" />
      </div>
    </Lesson>
  ),
};

export const AttachedToAPoint: Story = {
  name: 'Attached to a point',
  parameters: {
    docs: {
      description: {
        story:
          'A point is a scene object like a node: a wire, a callout or a projection names it by id and stays attached while it moves.',
      },
    },
  },
  render: () => (
    <Scene
      title="Where training settles"
      description="Synthetic loss L(w) = ½(w − 1)² + 0.3. A note and a dashed wire point at the lowest point of the curve."
      locale="en-US"
      x={[-2, 4]}
      y={[0, 5]}
    >
      <SceneAxes x={{ label: 'Weight w' }} y={{ label: 'Loss' }} />
      <SceneCurve id="loss" of={loss} resolution="fine" label="The loss curve" />
      <ScenePoint id="lowest" at={[1, FLOOR]} label={`The lowest loss, ${FLOOR}, at a weight of 1`} />
      <SceneNode id="goal" at={[3, 4]} size="small" shape="pill" text="Goal" label="What training aims for" />
      <SceneWire from="goal" to="lowest" isDashed label="Training aims for the lowest loss" />
      <SceneCallout to="lowest" side="top">
        The slope is zero here, so gradient descent stops moving the weight.
      </SceneCallout>
    </Scene>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <SigmoidLesson />
    </div>
  ),
};

export const AuthorErrors: Story = {
  render: () => (
    <div {...stylex.props(styles.list)}>
      <Scene title="A curve with no source" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneCurve id="nothing" />
      </Scene>
      <Scene title="A function that is not a number" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneCurve id="log" of={(value) => Math.log(value - 2)} />
      </Scene>
      <Scene title="Points that go backwards" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneCurve
          id="back"
          points={[
            [2, 1],
            [1, 2],
          ]}
        />
      </Scene>
      <Scene title="A movable point with no label" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <ScenePoint id="free" at={[1, 1]} onMove={() => undefined} />
      </Scene>
      <Scene title="A point that sets params outside a Lesson" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <ScenePoint id="loose" at={[1, 1]} label="A loose point" sets={{ x: 'z' }} />
      </Scene>
      <Lesson lesson={probe} locale="en-US">
        <Scene title="A point that sets a param the lesson lacks" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
          <ScenePoint id="typo" at={[1, 1]} label="A point with a typo" sets={{ x: 'weight' }} />
        </Scene>
      </Lesson>
      <Scene title="A point outside the box" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <ScenePoint id="far" at={[9, 1]} label="Far away" />
      </Scene>
      <Scene title="A projection of a missing point" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneAxes />
        <SceneProjection id="drop" of="ghost" />
      </Scene>
      <Scene title="A region with two shapes" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneRegion id="both" above={1} below={3} />
      </Scene>
      <Scene title="A rule with two directions" locale="en-US" x={[0, 4]} y={[0, 4]} height="compact">
        <SceneRule id="cross" x={1} y={1} />
      </Scene>
    </div>
  ),
};

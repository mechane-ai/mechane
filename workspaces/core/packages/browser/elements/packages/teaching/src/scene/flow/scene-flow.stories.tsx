import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ChartLink, useChartLinkControl } from '../../../../charts/src/index.ts';
import { colors, controls, radii, spacing, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from '../../lesson/define-lesson.ts';
import { Lesson } from '../../lesson/lesson.tsx';
import { ParamChoice, ParamSlider, ParamToggle } from '../../lesson/param-controls.tsx';
import { Param, Value } from '../../lesson/param.tsx';
import { SceneNode } from '../scene-node.tsx';
import { Scene } from '../scene.tsx';
import { LessonFlow, SceneFlow } from './scene-flow.tsx';

const meta = {
  title: 'Teaching/SceneFlow',
  component: SceneFlow,
  parameters: {
    docs: {
      description: {
        component:
          'SceneFlow draws a lesson’s derivation as a live diagram: each param and derived value is a node in layers from left to right, wired to the values it reads. Params are inline controls, every node shows its value in its format, and a change glows through what it touched, layer by layer. The author supplies a Lesson around it and, optionally, the names to show and plain-text formulas; LessonFlow is the same flow as a figure of its own.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Synthetic scores for the next token after “The ___ sat on the mat”. */
const candidates = [
  { id: 'cat', label: 'cat', score: 2.4 },
  { id: 'dog', label: 'dog', score: 1.9 },
  { id: 'car', label: 'car', score: 0.6 },
  { id: 'sun', label: 'sun', score: -0.4 },
] as const;

/** The share of each candidate after dividing scores by the temperature, optionally keeping the best two. */
function shares(temperature: number, isTopTwo: boolean): ReadonlyArray<number> {
  const weights = candidates.map((candidate, rank) =>
    isTopTwo && rank > 1 ? 0 : Math.exp(candidate.score / temperature),
  );

  const whole = { sum: 0 };

  for (const weight of weights) {
    whole.sum += weight;
  }

  return weights.map((weight) => weight / whole.sum);
}

const softmax = defineLesson({
  id: 'flow-softmax',
  title: 'From scores to surprise',
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
      label: 'Next token',
      value: 'cat',
      options: candidates.map((candidate) => ({ id: candidate.id, label: candidate.label })),
    },
    isTopTwo: { kind: 'toggle', label: 'Top two only', value: false },
  },
  derived: {
    probability: {
      label: 'Probability',
      format: { style: 'percent', maximumFractionDigits: 1 },
      from: ({ temperature, isTopTwo, token }) =>
        shares(temperature, isTopTwo)[candidates.findIndex((candidate) => candidate.id === token)] ?? 0,
    },
    entropy: {
      label: 'Entropy',
      format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 },
      from: ({ temperature, isTopTwo }) => {
        const bits = { sum: 0 };

        for (const share of shares(temperature, isTopTwo)) {
          bits.sum -= share > 0 ? share * Math.log2(share) : 0;
        }

        return bits.sum;
      },
    },
    surprise: {
      label: 'Surprise',
      format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 },
      from: ({ probability }) => (probability > 0 ? -Math.log2(probability) : 0),
    },
  },
});

const softmaxFormulas = { probability: 'eˢ⁽ᵗᵒᵏᵉⁿ⁾ᐟᵀ / Σ eˢᐟᵀ', entropy: '−Σ p log₂ p', surprise: '−log₂ p' } as const;

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/** A weight or input slider from −2 to 2. */
function signed(
  label: string,
  value: number,
): {
  readonly kind: 'number';
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: { readonly maximumFractionDigits: number };
} {
  return { kind: 'number', label, value, min: -2, max: 2, step: 0.1, format: { maximumFractionDigits: 1 } };
}

const twoDecimals = { maximumFractionDigits: 2 } as const;

const neuron = defineLesson({
  id: 'flow-neuron',
  title: 'One neuron, forward and loss',
  params: {
    x1: signed('Input x₁', 0.8),
    w1: signed('Weight w₁', 0.6),
    x2: signed('Input x₂', -0.5),
    w2: signed('Weight w₂', 1.2),
    bias: signed('Bias b', 0.1),
    target: {
      kind: 'number',
      label: 'Target y',
      value: 1,
      min: 0,
      max: 1,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    first: { label: 'w₁·x₁', format: twoDecimals, from: ({ w1, x1 }) => w1 * x1 },
    second: { label: 'w₂·x₂', format: twoDecimals, from: ({ w2, x2 }) => w2 * x2 },
    sum: { label: 'Weighted sum z', format: twoDecimals, from: ({ first, second, bias }) => first + second + bias },
    output: { label: 'Output a', format: { maximumFractionDigits: 3 }, from: ({ sum }) => sigmoid(sum) },
    error: { label: 'Error', format: { maximumFractionDigits: 3 }, from: ({ output, target }) => output - target },
    loss: { label: 'Squared loss', format: { maximumFractionDigits: 3 }, from: ({ error }) => error * error },
  },
});

const neuronFormulas = {
  first: 'w₁ × x₁',
  second: 'w₂ × x₂',
  sum: 'w₁x₁ + w₂x₂ + b',
  output: 'σ(z) = 1 / (1 + e⁻ᶻ)',
  error: 'a − y',
  loss: '(a − y)²',
} as const;

const styles = stylex.create({
  page: { display: 'grid', gap: spacing.lg, minWidth: 0, maxWidth: 1100, color: colors.ink },
  prose: {
    margin: 0,
    maxWidth: '64ch',
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
  panel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
    gap: spacing.lg,
    alignItems: 'start',
  },
  narrow: { width: 320, display: 'grid', gap: spacing.lg },
  term: {
    'paddingInline': spacing.xxs,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': colors.canvas,
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'lineHeight': 'inherit',
    'cursor': 'help',
    'textDecorationLine': 'underline',
    'textDecorationStyle': 'dotted',
    ':focus-visible': { outlineWidth: controls.focusWidth, outlineStyle: 'solid', outlineColor: colors.focus },
  },
});

/** A word in the prose that points every linked figure at a value while hovered or focused. */
function Inspects({ name, children }: { readonly name: string; readonly children: string }): ReactNode {
  const link = useChartLinkControl();

  return (
    <button
      type="button"
      {...stylex.props(styles.term)}
      onPointerEnter={(event) => link?.inspect(name, { reason: 'item-hover', event: event.nativeEvent })}
      onPointerLeave={(event) => link?.inspect(null, { reason: 'item-hover', event: event.nativeEvent })}
      onFocus={(event) => link?.inspect(name, { reason: 'focus-in', event: event.nativeEvent })}
      onBlur={(event) => link?.inspect(null, { reason: 'focus-out', event: event.nativeEvent })}
    >
      {children}
    </button>
  );
}

function SoftmaxPage(): ReactNode {
  return (
    <ChartLink>
      <div {...stylex.props(styles.page)}>
        <p {...stylex.props(styles.prose)}>
          Divide synthetic next-token scores by a temperature of <Param name="temperature" /> and <Param name="token" />{' '}
          gets <Value name="probability" />. Its <Inspects name="surprise">surprise</Inspects> is{' '}
          <Value name="surprise" />, against an <Inspects name="entropy">entropy</Inspects> of <Value name="entropy" />.
        </p>
        <LessonFlow
          description="Synthetic scores. Each value sits one layer after what it reads; change any control and the change runs through the diagram."
          formula={softmaxFormulas}
        />
        <div {...stylex.props(styles.panel)}>
          <ParamSlider name="temperature" />
          <ParamChoice name="token" />
          <ParamToggle name="isTopTwo" />
        </div>
      </div>
    </ChartLink>
  );
}

export const Default: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US">
      <SoftmaxPage />
    </Lesson>
  ),
};

export const ForwardPass: Story = {
  render: () => (
    <Lesson lesson={neuron} locale="en-US">
      <div {...stylex.props(styles.page)}>
        <p {...stylex.props(styles.prose)}>
          A neuron with two inputs (synthetic values). With weight <Param name="w1" /> on the first input the loss is{' '}
          <Value name="loss" />.
        </p>
        <LessonFlow
          title="A forward pass and its loss"
          description="Synthetic values. Twelve values in six layers: change a weight and watch the change reach the loss."
          formula={neuronFormulas}
        />
      </div>
    </Lesson>
  ),
};

export const OneValuesAncestry: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US">
      <div {...stylex.props(styles.page)}>
        <LessonFlow
          title="What surprise depends on"
          description="Synthetic scores. Only surprise and the values it reads; entropy is left out."
          names={['surprise']}
          formula={softmaxFormulas}
        />
      </div>
    </Lesson>
  ),
};

export const InsideAScene: Story = {
  render: () => (
    <Lesson lesson={neuron} locale="en-US">
      <Scene
        title="The flow beside other scene parts"
        description="Synthetic values. SceneFlow fills the right of the box; a plain node on the left names the stage."
        x={[0, 6]}
        y={[0, 3]}
        height="tall"
        minWidth={1100}
      >
        <SceneNode id="stage" at={[0, 1.5]} size="small" shape="plain" text="Forward" />
        <SceneFlow at={{ x: [1, 6], y: [0, 3] }} names={['sum']} formula={neuronFormulas} />
      </Scene>
    </Lesson>
  ),
};

export const Narrow: Story = {
  render: () => (
    <Lesson lesson={softmax} locale="en-US">
      <div {...stylex.props(styles.narrow)}>
        <LessonFlow
          description="Synthetic scores, at 320 pixels. The plot keeps node sizes and scrolls inside itself when the layers need more room."
          formula={softmaxFormulas}
        />
        <ParamSlider name="temperature" />
      </div>
    </Lesson>
  ),
};

export const AuthorErrors: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <Lesson lesson={softmax} locale="en-US">
        <LessonFlow title="A misspelled name" names={['surprize']} />
      </Lesson>
      <Lesson lesson={neuron} locale="en-US">
        <LessonFlow title="Too many values in one column" height="compact" />
      </Lesson>
      <Scene title="A flow with no Lesson around it" locale="en-US" x={[0, 1]} y={[0, 1]} height="compact">
        <SceneFlow />
      </Scene>
      <Lesson lesson={softmax} locale="en-US">
        <SceneFlow />
      </Lesson>
    </div>
  ),
};

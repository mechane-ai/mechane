import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '../../../forms/src/index.ts';
import { SceneNode } from './scene-node.tsx';
import { SceneWire } from './scene-wire.tsx';
import { Scene } from './scene.tsx';

const NARROW_WIDTH = 320;
const STORY_GAP = 24;

const styles = stylex.create({ list: { display: 'grid', gap: STORY_GAP }, narrow: { width: NARROW_WIDTH } });

const meta = {
  title: 'Teaching/Scene',
  component: Scene,
  parameters: {
    docs: {
      description: {
        component:
          'A diagram with identity on the plot kernel: nodes, wires, groups and notes placed in a data box. Change a part’s props and it eases to the new state; the reader steps through labelled parts with the arrow keys and reads each in the readout. The author supplies the box, the parts with stable ids, and a locale or an enclosing Lesson.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const inputs = [
  { id: 'x1', name: 'x₁', value: 0.8, weight: 0.6, row: 2.5 },
  { id: 'x2', name: 'x₂', value: 0.2, weight: -0.9, row: 1.5 },
  { id: 'x3', name: 'x₃', value: 0.5, weight: 0.3, row: 0.5 },
] as const;

function Neuron(): ReactNode {
  return (
    <>
      {inputs.map((input) => (
        <SceneNode
          key={input.id}
          id={input.id}
          at={[0, input.row]}
          text={`${input.name} = ${input.value}`}
          label={`Input ${input.name}, value ${input.value}`}
        />
      ))}
      <SceneNode id="sum" at={[2, 1.5]} shape="circle" text="Σ" label="Weighted sum, 0.45" tone="series1" />
      <SceneNode id="out" at={[4, 1.5]} shape="pill" text="σ(Σ) = 0.61" label="Output after the sigmoid, 0.61" />
      {inputs.map((input) => (
        <SceneWire
          key={input.id}
          from={input.id}
          to="sum"
          weight={input.weight}
          text={String(input.weight)}
          label={`Weight from ${input.name} to the sum, ${input.weight}`}
        />
      ))}
      <SceneWire from="sum" to="out" label="The sum passes through the sigmoid" />
    </>
  );
}

export const Default: Story = {
  render: () => (
    <Scene
      title="One artificial neuron"
      description="Synthetic values. Each input is multiplied by its weight; thickness shows the weight's size and hue its sign."
      locale="en-US"
      x={[0, 4]}
      y={[0, 3]}
    >
      <Neuron />
    </Scene>
  ),
};

type Step = {
  readonly id: string;
  readonly label: string;
  readonly weights: readonly [number, number, number];
  readonly hasBias: boolean;
  readonly hasThird: boolean;
  readonly hasOutput: boolean;
  readonly sumAt: readonly [number, number];
  readonly focus: ReadonlyArray<string> | null;
};

const steps: ReadonlyArray<Step> = [
  {
    id: 'inputs',
    label: 'Inputs',
    weights: [0.2, 0.2, 0.2],
    hasBias: false,
    hasThird: true,
    hasOutput: false,
    sumAt: [2, 1.5],
    focus: null,
  },
  {
    id: 'weights',
    label: 'Weights',
    weights: [0.6, -0.9, 0.3],
    hasBias: true,
    hasThird: true,
    hasOutput: false,
    sumAt: [2, 1.5],
    focus: null,
  },
  {
    id: 'sum',
    label: 'Zoom',
    weights: [0.6, -0.9, 0.3],
    hasBias: true,
    hasThird: true,
    hasOutput: false,
    sumAt: [2.5, 2],
    focus: ['sum', 'bias'],
  },
  {
    id: 'output',
    label: 'Output',
    weights: [0.9, -0.4, 0.3],
    hasBias: true,
    hasThird: false,
    hasOutput: true,
    sumAt: [2, 1],
    focus: null,
  },
];

function SteppedNeuron(): ReactNode {
  const [stepId, setStepId] = useState('inputs');
  const step = steps.find((candidate) => candidate.id === stepId) ?? steps[0];

  if (step === undefined) {
    return null;
  }

  const shown = inputs.filter((input) => input.id !== 'x3' || step.hasThird);

  return (
    <Scene
      title="Building a neuron, step by step"
      description="Synthetic values. Each step changes props only; nodes with the same id move, appear and fade, and the camera zooms."
      locale="en-US"
      x={[0, 4]}
      y={[0, 3]}
      focus={step.focus}
      pace="slow"
      actions={
        <SegmentedControl.Root value={stepId} onValueChange={setStepId} aria-label="Step">
          {steps.map((candidate) => (
            <SegmentedControl.Item key={candidate.id} value={candidate.id}>
              {candidate.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      }
    >
      {inputs.map((input) => (
        <SceneNode
          key={input.id}
          id={input.id}
          at={[0, input.row]}
          text={`${input.name} = ${input.value}`}
          label={`Input ${input.name}, value ${input.value}`}
          isShown={input.id !== 'x3' || step.hasThird}
        />
      ))}
      <SceneNode
        id="bias"
        at={[2, 2.75]}
        size="small"
        shape="pill"
        text="b = 0.1"
        label="Bias, 0.1"
        isShown={step.hasBias}
      />
      <SceneNode id="sum" at={step.sumAt} shape="circle" text="Σ" label="Weighted sum" tone="series1" />
      <SceneNode id="out" at={[4, 1]} shape="pill" text="ŷ = 0.73" label="Output, 0.73" isShown={step.hasOutput} />
      {shown.map((input, index) => (
        <SceneWire
          key={input.id}
          from={input.id}
          to="sum"
          weight={step.weights[index]}
          text={String(step.weights[index])}
          label={`Weight from ${input.name}, ${step.weights[index]}`}
        />
      ))}
      <SceneWire from="bias" to="sum" isDashed isShown={step.hasBias} label="The bias joins the sum" />
      <SceneWire from="sum" to="out" shape="curve" isShown={step.hasOutput} label="The sum becomes the output" />
    </Scene>
  );
}

export const Stepped: Story = { render: () => <SteppedNeuron /> };

const COLUMNS = 15;
const ROWS = 10;

const grid = Array.from({ length: COLUMNS * ROWS }, (_, index) => ({
  id: `n${index}`,
  column: index % COLUMNS,
  row: Math.floor(index / COLUMNS),
}));

const links = grid.flatMap((node) => [
  ...(node.column < COLUMNS - 1 ? [{ from: node.id, to: `n${node.row * COLUMNS + node.column + 1}` }] : []),
  ...(node.row < ROWS - 1 ? [{ from: node.id, to: `n${(node.row + 1) * COLUMNS + node.column}` }] : []),
  ...((node.row + node.column) % 6 === 0 && node.row < ROWS - 1 && node.column < COLUMNS - 1
    ? [{ from: node.id, to: `n${(node.row + 1) * COLUMNS + node.column + 1}` }]
    : []),
]);

function LargeGrid(): ReactNode {
  const [isTwisted, setTwisted] = useState(false);

  return (
    <Scene
      title={`${grid.length} nodes and ${links.length} wires`}
      description="Synthetic layout for the performance check. Switching layout moves every node at once; every wire follows."
      locale="en-US"
      x={[0, COLUMNS - 1]}
      y={[0, ROWS - 1]}
      height="tall"
      actions={
        <SegmentedControl.Root
          value={isTwisted ? 'twisted' : 'grid'}
          onValueChange={(value) => setTwisted(value === 'twisted')}
          aria-label="Layout"
        >
          <SegmentedControl.Item value="grid">Grid</SegmentedControl.Item>
          <SegmentedControl.Item value="twisted">Twisted</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      {grid.map((node) => {
        const wave = isTwisted ? 0.35 * Math.sin((node.row / (ROWS - 1)) * Math.PI * 2) : 0;
        const column = Math.min(COLUMNS - 1, Math.max(0, node.column + wave * (ROWS - 1 - node.row) * 0.2));

        return (
          <SceneNode
            key={node.id}
            id={node.id}
            at={[isTwisted ? COLUMNS - 1 - column : node.column, node.row]}
            size="small"
            shape="circle"
            label={`Node ${node.id}`}
            tone={node.row % 3 === 0 ? 'series2' : 'neutral'}
          />
        );
      })}
      {links.map((link) => (
        <SceneWire key={`${link.from}>${link.to}`} from={link.from} to={link.to} hasArrow={false} />
      ))}
    </Scene>
  );
}

export const Large: Story = { render: () => <LargeGrid /> };

export const WireAroundANode: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A wire runs straight between the edges of its ends and does not avoid what lies between them. Here the skip connection from the input to the output would cross the layer, so `bend` bows it 36 pixels above the row; a negative bend would bow it below. Its arrow and text follow the curve.',
      },
    },
  },
  render: () => (
    <Scene
      title="A skip connection"
      description="Synthetic block. The input feeds the layer and also skips around it to the output."
      locale="en-US"
      x={[0, 4]}
      y={[0, 2]}
    >
      <SceneNode id="input" at={[0.5, 1]} size="small" text="x" label="The input" />
      <SceneNode id="layer" at={[2, 1]} size="small" text="f(x)" label="The layer" tone="series1" />
      <SceneNode id="output" at={[3.5, 1]} size="small" text="x + f(x)" label="The output" />
      <SceneWire from="input" to="layer" label="The input enters the layer" />
      <SceneWire from="layer" to="output" label="The layer's result goes to the output" />
      <SceneWire from="input" to="output" bend={36} text="skip" label="The input skips the layer" />
    </Scene>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div {...stylex.props(styles.list)}>
      <Scene title="A wire to a missing node" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact">
        <SceneNode id="a" at={[0, 0.5]} text="a" />
        <SceneWire from="a" to="b" />
      </Scene>
      <Scene title="Two nodes with one id" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact">
        <SceneNode id="a" at={[0, 0.5]} text="a" />
        <SceneNode id="a" at={[2, 0.5]} text="a again" />
      </Scene>
      <Scene title="A node outside the box" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact">
        <SceneNode id="far" at={[3, 0.5]} text="far" />
      </Scene>
      <Scene title="A weight beyond the limit" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact">
        <SceneNode id="a" at={[0, 0.5]} text="a" />
        <SceneNode id="b" at={[2, 0.5]} text="b" />
        <SceneWire from="a" to="b" weight={2.5} />
      </Scene>
      <Scene title="A reversed box" locale="en-US" x={[2, 0]} y={[0, 1]} height="compact">
        <SceneNode id="a" at={[1, 0.5]} text="a" />
      </Scene>
      <Scene title="Loading" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact" status="loading">
        <SceneNode id="a" at={[1, 0.5]} text="a" />
      </Scene>
      <Scene title="Nothing to draw" locale="en-US" x={[0, 2]} y={[0, 1]} height="compact" />
      <Scene title="No locale" x={[0, 2]} y={[0, 1]}>
        <SceneNode id="a" at={[1, 0.5]} text="a" />
      </Scene>
    </div>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <Scene
        title="One artificial neuron"
        description="Synthetic values, at 320 pixels. The plot keeps node sizes and scrolls inside itself if the row needs more room."
        locale="en-US"
        x={[0, 4]}
        y={[0, 3]}
      >
        <Neuron />
      </Scene>
    </div>
  ),
};

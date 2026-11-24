import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CurveChart } from '../../../charts/src/trend/index.ts';
import { SegmentedControl } from '../../../forms/src/index.ts';
import { SceneNode } from './scene-node.tsx';
import { SceneWire } from './scene-wire.tsx';
import { Scene } from './scene.tsx';

const meta = {
  title: 'Teaching/SceneNode',
  component: SceneNode,
  parameters: {
    docs: {
      description: {
        component:
          'A box, pill or circle in a Scene, named by `text` and described for the readout by `label`. Its size is a named pixel box or an exact one, so text fits without measuring. It can hold any Elements component, keeps it while it moves or grows, and turns, lifts and tilts in 3D for card-like explanations.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const lossSteps = Array.from({ length: 24 }, (_, index) => (index + 1) * 250);

const loss = [
  {
    id: 'train',
    label: 'Training loss',
    points: lossSteps.map((step) => ({ x: step, y: 0.9 + 2.6 * Math.exp(-step / 1400) })),
  },
];

function GrowingChart(): ReactNode {
  const [isLarge, setLarge] = useState(false);

  return (
    <Scene
      title="A node that holds a chart"
      description="Synthetic loss curve. The node grows and moves; the chart inside keeps its state, so an inspected step stays inspected."
      locale="en-US"
      x={[0, 3]}
      y={[0, 2]}
      height="tall"
      pace="slow"
      actions={
        <SegmentedControl.Root
          value={isLarge ? 'large' : 'small'}
          onValueChange={(value) => setLarge(value === 'large')}
          aria-label="Node size"
        >
          <SegmentedControl.Item value="small">Small</SegmentedControl.Item>
          <SegmentedControl.Item value="large">Large</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      <SceneNode id="data" at={[0, 1]} text="Batch" label="A batch of training data" shape="pill" />
      <SceneNode
        id="run"
        at={isLarge ? [1.9, 1] : [2.3, 1]}
        size={isLarge ? { width: 440, height: 330 } : { width: 280, height: 290 }}
        text="Training run"
        label="The training run and its loss curve"
        tone="series1"
      >
        <CurveChart
          title="Loss"
          locale="en-US"
          height="compact"
          series={loss}
          x={{ label: 'Step', format: { maximumFractionDigits: 0 } }}
          y={{ label: 'Loss', domain: [0, 4], format: { maximumFractionDigits: 2 } }}
        />
      </SceneNode>
      <SceneWire from="data" to="run" label="Batches feed the run" />
    </Scene>
  );
}

export const HoldsAChart: Story = {
  parameters: {
    docs: { description: { story: 'A node with rich content resizes without losing that content’s state.' } },
  },
  render: () => <GrowingChart />,
};

type Pose = 'rest' | 'lift' | 'tilt' | 'turn';

const poses: Readonly<Record<Pose, { readonly turn: number; readonly lift: number; readonly tilt: number }>> = {
  rest: { turn: 0, lift: 0, tilt: 0 },
  lift: { turn: 0, lift: 1, tilt: 0 },
  tilt: { turn: 0, lift: 0.4, tilt: 28 },
  turn: { turn: 1, lift: 0.6, tilt: 0 },
};

const poseIds: Readonly<Record<string, Pose | undefined>> = { rest: 'rest', lift: 'lift', tilt: 'tilt', turn: 'turn' };

const hand = [
  { id: 'queen', text: 'Q♥', label: 'Queen of Hearts, probability 0.5', at: 0.6, tone: 'negative' },
  { id: 'king', text: 'K♠', label: 'King of Spades, probability 0.3', at: 1.5, tone: 'series1' },
  { id: 'ace', text: 'A♦', label: 'Ace of Diamonds, probability 0.2', at: 2.4, tone: 'negative' },
] as const;

function Cards(): ReactNode {
  const [pose, setPose] = useState<Pose>('rest');

  return (
    <Scene
      title="Cards that turn, lift and tilt"
      description="Synthetic probabilities. The middle card takes the chosen pose; its back face says what it means."
      locale="en-US"
      x={[0, 3]}
      y={[0, 1]}
      height="tall"
      pace="slow"
      actions={
        <SegmentedControl.Root
          value={pose}
          onValueChange={(value) => setPose(poseIds[value] ?? 'rest')}
          aria-label="Pose"
        >
          <SegmentedControl.Item value="rest">Rest</SegmentedControl.Item>
          <SegmentedControl.Item value="lift">Lift</SegmentedControl.Item>
          <SegmentedControl.Item value="tilt">Tilt</SegmentedControl.Item>
          <SegmentedControl.Item value="turn">Turn</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      {hand.map((card) => (
        <SceneNode
          key={card.id}
          id={card.id}
          at={[card.at, 0.5]}
          size={{ width: 96, height: 136 }}
          text={card.text}
          label={card.label}
          tone={card.tone}
          {...(card.id === 'king' ? poses[pose] : poses.rest)}
          back={<span>p = {card.label.split(' ').at(-1)}</span>}
        />
      ))}
    </Scene>
  );
}

export const Card: Story = {
  parameters: {
    docs: {
      description: { story: 'Depth is part of a node: `turn` flips to the `back` face, `lift` raises, `tilt` leans.' },
    },
  },
  render: () => <Cards />,
};

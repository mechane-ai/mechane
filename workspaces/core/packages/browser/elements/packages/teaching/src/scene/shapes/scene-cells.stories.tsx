import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '../../../../forms/src/index.ts';
import { SceneNode } from '../scene-node.tsx';
import { SceneWire } from '../scene-wire.tsx';
import { Scene } from '../scene.tsx';
import { SceneCells } from './scene-cells.tsx';

const NARROW_WIDTH = 320;
const STORY_GAP = 24;

const styles = stylex.create({ list: { display: 'grid', gap: STORY_GAP }, narrow: { width: NARROW_WIDTH } });

const meta = {
  title: 'Teaching/SceneCells',
  component: SceneCells,
  parameters: {
    docs: {
      description: {
        component:
          'A vector, a weight matrix or an embedding row as a grid of numbered cells in a Scene. Every cell has its own id, the grid’s id then its row and column joined by dots, such as `W.1.2`, so wires, callouts and brackets point at one number. Change `values` and the numbers count to their new values while the color eases. The author supplies the numbers, a format, and optionally a color meaning, labels and a highlight. All numbers here are synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const input = [0.8, -0.4, 0.5];

const weights = [
  [0.6, -0.2, 0.9],
  [0.3, 0.8, -0.5],
  [-0.7, 0.1, 0.4],
];

const output = [0, 1, 2].map((column) =>
  weights.map((row, index) => (input[index] ?? 0) * (row[column] ?? 0)).reduce((sum, term) => sum + term, 0),
);

const rowLabels = ['x₁', 'x₂', 'x₃'];
const columnLabels = ['h₁', 'h₂', 'h₃'];
const rowIds = ['0', '1', '2'] as const;

const rowChoices: Readonly<Record<string, number | undefined>> = { 0: 0, 1: 1, 2: 2 };

function VectorTimesMatrix(): ReactNode {
  const [row, setRow] = useState(1);

  return (
    <Scene
      title="A vector times a matrix"
      description="Synthetic numbers. The input vector x multiplies the weight matrix W; each row of W scales one input, and the products add up in a sum. Choose the highlighted row."
      locale="en-US"
      x={[0, 6]}
      y={[0, 4]}
      height="tall"
      actions={
        <SegmentedControl.Root
          value={String(row)}
          onValueChange={(value) => setRow(rowChoices[value] ?? 0)}
          aria-label="Highlighted row"
        >
          {rowIds.map((name) => (
            <SegmentedControl.Item key={name} value={name}>
              {`Row ${Number(name) + 1}`}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      }
    >
      <SceneCells
        id="x"
        at={[1, 2.4]}
        values={input.map((value) => [value])}
        palette="diverging"
        domain={[-1, 1]}
        highlight={{ row }}
        label="The input vector x"
      />
      <SceneCells
        id="W"
        at={[3.1, 2.4]}
        values={weights}
        palette="diverging"
        domain={[-1, 1]}
        rowLabels={rowLabels}
        columnLabels={columnLabels}
        highlight={{ row }}
        label="The weight matrix W"
      />
      <SceneCells
        id="y"
        at={[3.1, 0.6]}
        values={output}
        palette="diverging"
        domain={[-1, 1]}
        label="The output y = xW"
      />
      <SceneNode
        id="sum"
        at={[5.3, 2.4]}
        shape="circle"
        size="medium"
        text="Σ"
        label="Sum of the products in one column"
        tone="series1"
      />
      {rowIds.map((name) => (
        <SceneWire
          key={name}
          from={`W.${name}.2`}
          to="sum"
          label={`Weight in row ${Number(name) + 1} feeds the sum`}
          isShown={row === Number(name)}
        />
      ))}
      <SceneWire from="sum" to="y.0.2" label="The sum is the third output" />
    </Scene>
  );
}

export const VectorTimesMatrixStory: Story = {
  name: 'Vector times matrix',
  parameters: {
    docs: {
      description: {
        story:
          'Two grids with the same row count line up on one grid of pixels. The highlight marks a row in both; a wire runs from one cell of W to a sum node and on to one cell of the output.',
      },
    },
  },
  render: () => <VectorTimesMatrix />,
};

const states = [
  { id: 'start', label: 'Start', values: [0.1, -0.3, 0.7, 0.2, -0.6] },
  { id: 'step-one', label: 'After step 1', values: [0.4, -0.1, 0.5, -0.2, -0.3] },
  { id: 'step-two', label: 'After step 2', values: [0.9, 0.3, -0.4, -0.7, 0.1] },
] as const;

const stateChoices: Readonly<Record<string, number | undefined>> = { 'start': 0, 'step-one': 1, 'step-two': 2 };

function ChangingValues(): ReactNode {
  const [index, setIndex] = useState(0);
  const state = states[index] ?? states[0];

  return (
    <Scene
      title="An embedding that changes over training"
      description="Synthetic five-dimensional embedding. Change the state and each number counts to its new value while its color moves from one hue to the other."
      locale="en-US"
      x={[0, 4]}
      y={[0, 2]}
      pace="slow"
      actions={
        <SegmentedControl.Root
          value={state.id}
          onValueChange={(value) => setIndex(stateChoices[value] ?? 0)}
          aria-label="Training state"
        >
          {states.map((item) => (
            <SegmentedControl.Item key={item.id} value={item.id}>
              {item.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      }
    >
      <SceneCells
        id="embedding"
        at={[2, 1]}
        values={state.values}
        size="large"
        palette="diverging"
        domain={[-1, 1]}
        columnLabels={['d₁', 'd₂', 'd₃', 'd₄', 'd₅']}
        label={`The embedding of the word cat, ${state.label}`}
      />
    </Scene>
  );
}

export const ValuesChange: Story = {
  parameters: {
    docs: { description: { story: 'Each cell keeps its id, so a change of `values` eases the number and its color.' } },
  },
  render: () => <ChangingValues />,
};

export const ColorMeanings: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Without a `palette` cells are plain, `sequential` shades one hue by size, and `diverging` uses two hues around a neutral zero. These are the scales of the matrix charts, so a grid and a heatmap read alike.',
      },
    },
  },
  render: () => (
    <Scene
      title="Three ways to color the same numbers"
      description="Synthetic attention scores. Plain, shaded by magnitude, and colored by sign."
      locale="en-US"
      x={[0, 4]}
      y={[0, 3]}
      height="tall"
    >
      <SceneCells id="plain" at={[2, 2.4]} values={[0.2, -0.8, 0.5, 0.9]} label="Plain scores" rowLabels={['plain']} />
      <SceneCells
        id="magnitude"
        at={[2, 1.5]}
        values={[0.2, 0.8, 0.5, 0.9]}
        palette="sequential"
        label="Scores shaded by magnitude"
        rowLabels={['sequential']}
      />
      <SceneCells
        id="signed"
        at={[2, 0.6]}
        values={[0.2, -0.8, 0.5, -0.1]}
        palette="diverging"
        label="Scores colored by sign"
        rowLabels={['diverging']}
      />
    </Scene>
  ),
};

export const Narrow: Story = {
  parameters: {
    docs: {
      description: { story: 'At 320 pixels the scene scrolls inside its frame; the grids keep their pixel sizes.' },
    },
  },
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <VectorTimesMatrix />
    </div>
  ),
};

export const AuthorErrors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Wrong input is named in the scene: rows of different lengths, labels that do not match, and nothing to draw.',
      },
    },
  },
  render: () => (
    <div {...stylex.props(styles.list)}>
      <Scene title="Rows of different lengths" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneCells
          id="ragged"
          at={[2, 1]}
          values={[
            [1, 2, 3],
            [4, 5],
          ]}
        />
      </Scene>
      <Scene title="Two labels for three columns" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneCells id="labelled" at={[2, 1]} values={[1, 2, 3]} columnLabels={['a', 'b']} />
      </Scene>
      <Scene title="Nothing to draw" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneCells id="empty" at={[2, 1]} />
      </Scene>
    </div>
  ),
};

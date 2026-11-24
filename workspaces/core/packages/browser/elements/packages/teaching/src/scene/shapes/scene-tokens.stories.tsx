import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '../../../../forms/src/index.ts';
import { SceneWire } from '../scene-wire.tsx';
import { Scene } from '../scene.tsx';
import { SceneToken } from './scene-token.tsx';
import { SceneTokens } from './scene-tokens.tsx';

const NARROW_WIDTH = 320;
const STORY_GAP = 24;
const PROMPT_WRAP = 360;

const styles = stylex.create({ list: { display: 'grid', gap: STORY_GAP }, narrow: { width: NARROW_WIDTH } });

const meta = {
  title: 'Teaching/SceneTokens',
  component: SceneTokens,
  parameters: {
    docs: {
      description: {
        component:
          'Text as tokens in a Scene. SceneToken is one token in the monospace face with its vocabulary id or probability under it; SceneTokens lays a sequence out in a row that wraps, with a stable id per position, such as `prompt.3`. The author supplies the token texts and, optionally, ids and probabilities. All text and numbers here are synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const prompt = [
  { text: 'The', tokenId: 464 },
  { text: ' cat', tokenId: 3797 },
  { text: ' sat', tokenId: 3332 },
  { text: ' on', tokenId: 319 },
  { text: ' the', tokenId: 262 },
];

type Candidate = { readonly id: string; readonly text: string; readonly probability: number };

const candidateSets: Readonly<Record<string, ReadonlyArray<Candidate>>> = {
  plain: [
    { id: 'mat', text: ' mat', probability: 0.46 },
    { id: 'floor', text: ' floor', probability: 0.21 },
    { id: 'sofa', text: ' sofa', probability: 0.12 },
    { id: 'roof', text: ' roof', probability: 0.04 },
  ],
  trained: [
    { id: 'mat', text: ' mat', probability: 0.78 },
    { id: 'floor', text: ' floor', probability: 0.1 },
    { id: 'sofa', text: ' sofa', probability: 0.06 },
    { id: 'roof', text: ' roof', probability: 0.01 },
  ],
};

const CANDIDATE_TOP = 3.3;
const CANDIDATE_STEP = 0.8;

function NextToken({ initial = 'plain' }: { readonly initial?: string }): ReactNode {
  const [model, setModel] = useState(initial);
  const candidates = candidateSets[model] ?? [];

  return (
    <Scene
      title="Predicting the next token"
      description="Synthetic prompt and probabilities. Each candidate for the next token is wired to the last token of the prompt; a wire is thicker for a likelier token."
      locale="en-US"
      x={[0, 6]}
      y={[0, 4]}
      height="tall"
      actions={
        <SegmentedControl.Root value={model} onValueChange={setModel} aria-label="Model">
          <SegmentedControl.Item value="plain">Untrained</SegmentedControl.Item>
          <SegmentedControl.Item value="trained">Trained</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      <SceneTokens
        id="prompt"
        at={[1.7, 2]}
        tokens={prompt}
        wrapWidth={PROMPT_WRAP}
        label="The prompt: The cat sat on the"
      />
      {candidates.map((candidate, index) => (
        <SceneToken
          key={candidate.id}
          id={candidate.id}
          at={[5.1, CANDIDATE_TOP - index * CANDIDATE_STEP]}
          text={candidate.text}
          probability={candidate.probability}
          tone="series1"
        />
      ))}
      {candidates.map((candidate) => (
        <SceneWire
          key={candidate.id}
          from="prompt.4"
          to={candidate.id}
          weight={candidate.probability}
          label={`The last token predicts ${candidate.text.trim()} with probability ${candidate.probability}`}
        />
      ))}
    </Scene>
  );
}

export const Prompt: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The prompt is one SceneTokens with ids `prompt.0` to `prompt.4`. The candidates are SceneTokens with probabilities; switch the model and their bars and numbers count to the new values while the wires thicken or thin.',
      },
    },
  },
  render: () => <NextToken />,
};

const longText = [
  'Tokens',
  ' are',
  ' the',
  ' pieces',
  ' a',
  ' model',
  ' reads',
  ',',
  ' not',
  ' words',
  '.',
  '\n',
  'Spaces',
  ' show',
  ' as',
  ' faint',
  ' marks',
].map((text) => ({ text }));

function Wrapping(): ReactNode {
  const [count, setCount] = useState(longText.length);

  return (
    <Scene
      title="A sequence that wraps"
      description="Synthetic text. The row wraps at a pixel width; show fewer tokens and the rest keep their places."
      locale="en-US"
      x={[0, 4]}
      y={[0, 2]}
      actions={
        <SegmentedControl.Root
          value={String(count)}
          onValueChange={(value) => setCount(Number(value))}
          aria-label="Tokens shown"
        >
          <SegmentedControl.Item value="7">7 tokens</SegmentedControl.Item>
          <SegmentedControl.Item value={String(longText.length)}>All</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      <SceneTokens
        id="text"
        at={[2, 1]}
        tokens={longText.slice(0, count)}
        wrapWidth={300}
        gap="small"
        label="A sentence as tokens"
      />
    </Scene>
  );
}

export const WrappingSequence: Story = {
  name: 'Wrapping sequence',
  parameters: {
    docs: {
      description: { story: 'Whitespace is kept in the token text and drawn as faint marks, as in the text charts.' },
    },
  },
  render: () => <Wrapping />,
};

export const Narrow: Story = {
  parameters: { docs: { description: { story: 'At 320 pixels the scene scrolls inside its frame.' } } },
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <NextToken initial="trained" />
    </div>
  ),
};

export const AuthorErrors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A wire to a token that does not exist, and a token outside the scene box, are named in the scene.',
      },
    },
  },
  render: () => (
    <div {...stylex.props(styles.list)}>
      <Scene title="A wire to a missing token" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneTokens id="prompt" at={[1, 1]} tokens={prompt.slice(0, 2)} />
        <SceneWire from="prompt.1" to="prompt.9" />
      </Scene>
      <Scene title="A token outside the box" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneToken id="far" at={[9, 1]} text="far" />
      </Scene>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart, ScatterPlot } from '../../../../charts/src/cartesian/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { SegmentedControl } from '../../../../forms/src/index.ts';
import { spacing } from '../../../../foundations/src/tokens.stylex.ts';
import type { Pace } from '../../time/tween.ts';
import { SceneNode } from '../scene-node.tsx';
import { SceneWire } from '../scene-wire.tsx';
import { Scene } from '../scene.tsx';
import { MorphScope } from './morph-scope.tsx';

const meta = {
  title: 'Teaching/MorphScope',
  component: MorphScope,
  parameters: {
    docs: {
      description: {
        component:
          'MorphScope shows one of several figures that draw the same things. When the author switches `show`, each thing both figures draw, matched by id, travels from its old place to its new one while the figures cross-fade; things in only one figure fade. The author supplies the figures as named slots and the name to show; every figure stays mounted and keeps its state.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const suits = [
  { id: 'hearts', symbol: '♥', label: 'Hearts', tone: 'negative' },
  { id: 'diamonds', symbol: '♦', label: 'Diamonds', tone: 'negative' },
  { id: 'clubs', symbol: '♣', label: 'Clubs', tone: 'neutral' },
  { id: 'spades', symbol: '♠', label: 'Spades', tone: 'neutral' },
] as const;

/** A synthetic hand of twelve cards, in the order they were dealt. */
const hand = [
  ['Q', 'hearts'],
  ['7', 'clubs'],
  ['2', 'diamonds'],
  ['K', 'clubs'],
  ['9', 'hearts'],
  ['A', 'spades'],
  ['4', 'clubs'],
  ['J', 'hearts'],
  ['10', 'diamonds'],
  ['3', 'clubs'],
  ['5', 'hearts'],
  ['8', 'clubs'],
] as const;

const cards = hand.map(([rank, suitId], index) => {
  const suit = suits.find((candidate) => candidate.id === suitId) ?? suits[0];
  const before = hand.slice(0, index).filter(([, other]) => other === suitId).length;

  return {
    id: `${suitId}:${rank}`,
    rank,
    suitId,
    text: `${rank}${suit.symbol}`,
    label: `${rank} of ${suit.label}`,
    tone: suit.tone,
    column: suits.indexOf(suit),
    height: before,
    index,
  };
});

const cardTones: Readonly<Record<string, ChartTone>> = Object.fromEntries(cards.map((card) => [card.id, card.tone]));
const counts = suits.map((suit) => cards.filter((card) => card.column === suits.indexOf(suit)).length);
const PILE_MIDDLE = 5.5;
const PILE_STEP = 0.14;
const PILE_JITTER = 0.08;
const SPREAD_COLUMNS = 4;
const SPREAD_TOP = 1.7;
const SPREAD_ROW = 0.7;
const CARD = { width: 44, height: 60 } as const;
const BLOCK = { width: 56, height: 48 } as const;

const styles = stylex.create({
  stack: { display: 'grid', gap: spacing.md, minWidth: 0, maxWidth: 900 },
  narrow: { width: 320 },
});

function Pile(): ReactNode {
  const [isSpread, setSpread] = useState(false);

  return (
    <Scene
      title="A dealt hand"
      description="Synthetic cards, in the order they were dealt."
      locale="en-US"
      x={[0, 5]}
      y={[0, 2]}
      height="tall"
      minWidth={0}
      actions={
        <SegmentedControl.Root
          value={isSpread ? 'spread' : 'pile'}
          onValueChange={(value) => setSpread(value === 'spread')}
          aria-label="Arrangement"
        >
          <SegmentedControl.Item value="pile">Pile</SegmentedControl.Item>
          <SegmentedControl.Item value="spread">Spread</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
    >
      {cards.map((card) => {
        const pile = [
          2.5 + (card.index - PILE_MIDDLE) * PILE_STEP,
          1 + (((card.index * 5) % 3) - 1) * PILE_JITTER,
        ] as const;

        const spread = [
          1 + (card.index % SPREAD_COLUMNS),
          SPREAD_TOP - Math.floor(card.index / SPREAD_COLUMNS) * SPREAD_ROW,
        ] as const;

        return (
          <SceneNode
            key={card.id}
            id={card.id}
            at={isSpread ? spread : pile}
            size={CARD}
            text={card.text}
            label={card.label}
            tone={card.tone}
          />
        );
      })}
    </Scene>
  );
}

function Counts(): ReactNode {
  return (
    <Scene
      title="Cards per suit"
      description="The same synthetic cards, stacked by suit: each bar is made of the cards themselves."
      locale="en-US"
      x={[0, suits.length - 1]}
      y={[0, 6]}
      height="tall"
    >
      {suits.map((suit, column) => (
        <SceneNode
          key={suit.id}
          id={`suit-${suit.id}`}
          at={[column, 0]}
          size="small"
          shape="plain"
          text={`${suit.symbol} ${counts[column] ?? 0}`}
          label={`${suit.label}: ${counts[column] ?? 0} cards`}
        />
      ))}
      {cards.map((card) => (
        <SceneNode
          key={card.id}
          id={card.id}
          at={[card.column, 0.9 + card.height]}
          size={BLOCK}
          text={card.text}
          label={card.label}
          tone={card.tone}
        />
      ))}
    </Scene>
  );
}

/** The same cards as a stacked bar chart: one series per card, so each segment is one card with the card's id. */
function CountChart(): ReactNode {
  return (
    <BarChart
      title="Cards per suit"
      description="The same synthetic cards as a stacked bar chart: each segment is one card, so a bar's height is the count."
      locale="en-US"
      categories={suits.map((suit) => ({ id: suit.id, label: suit.label }))}
      series={cards.map((card) => ({
        id: card.rank,
        label: card.text,
        tone: card.tone,
        values: suits.map((suit) => (suit.id === card.suitId ? 1 : 0)),
      }))}
      mode="stacked"
      domain={[0, 6]}
      valueFormat={{ maximumFractionDigits: 0 }}
      valueLabel="Cards"
      height="tall"
    />
  );
}

function CardsMorph({
  pace,
  isChart = true,
}: {
  readonly pace?: Pace | undefined;
  readonly isChart?: boolean | undefined;
}): ReactNode {
  const [shown, setShown] = useState<'pile' | 'counts'>('pile');

  return (
    <div {...stylex.props(styles.stack)}>
      <SegmentedControl.Root
        value={shown}
        onValueChange={(value) => setShown(value === 'counts' ? 'counts' : 'pile')}
        aria-label="Figure"
      >
        <SegmentedControl.Item value="pile">The hand</SegmentedControl.Item>
        <SegmentedControl.Item value="counts">Counts by suit</SegmentedControl.Item>
      </SegmentedControl.Root>
      <MorphScope
        figures={{ pile: <Pile />, counts: isChart ? <CountChart /> : <Counts /> }}
        show={shown}
        pace={pace}
        tones={cardTones}
      />
    </div>
  );
}

export const CardsToCounts: Story = { render: () => <CardsMorph /> };

export const SceneToScene: Story = {
  parameters: {
    docs: {
      description: { story: 'Both figures are scenes: the cards become blocks of a hand-drawn count, matched by id.' },
    },
  },
  render: () => <CardsMorph isChart={false} />,
};

/** A small synthetic network: two inputs, three hidden units and one output, with a 2-D embedding of each unit. */
const units = [
  { id: 'in-1', name: 'x₁', layer: 0, row: 1.5, embedding: [0.6, 3.2], tone: 'series1' },
  { id: 'in-2', name: 'x₂', layer: 0, row: 0.5, embedding: [1.1, 2.6], tone: 'series1' },
  { id: 'hid-1', name: 'h₁', layer: 1, row: 2, embedding: [2.6, 0.7], tone: 'series2' },
  { id: 'hid-2', name: 'h₂', layer: 1, row: 1, embedding: [3.4, 1.2], tone: 'series2' },
  { id: 'hid-3', name: 'h₃', layer: 1, row: 0, embedding: [1.9, 1.5], tone: 'series2' },
  { id: 'out', name: 'ŷ', layer: 2, row: 1, embedding: [3.6, 3.4], tone: 'series3' },
] as const;

const unitTones: Readonly<Record<string, ChartTone>> = Object.fromEntries(units.map((unit) => [unit.id, unit.tone]));

const connections = units.flatMap((source) =>
  units.filter((target) => target.layer === source.layer + 1).map((target) => ({ from: source.id, to: target.id })),
);

function Network(): ReactNode {
  return (
    <Scene title="The network" description="Synthetic units, by layer." locale="en-US" x={[0, 2]} y={[0, 2]}>
      {units.map((unit) => (
        <SceneNode
          key={unit.id}
          id={unit.id}
          at={[unit.layer, unit.row]}
          shape="circle"
          text={unit.name}
          label={`Unit ${unit.name}`}
          tone={unit.tone}
        />
      ))}
      {connections.map((link) => (
        <SceneWire key={`${link.from}>${link.to}`} from={link.from} to={link.to} hasArrow={false} />
      ))}
    </Scene>
  );
}

function Embedding(): ReactNode {
  return (
    <ScatterPlot
      title="The units as points"
      description="Each unit placed by a synthetic 2-D embedding of its activations; units close together respond alike."
      locale="en-US"
      points={units.map((unit) => ({
        id: unit.id,
        label: `Unit ${unit.name}`,
        x: unit.embedding[0],
        y: unit.embedding[1],
        tone: unit.tone,
      }))}
      x={{ label: 'Embedding axis 1', domain: [0, 4], format: { maximumFractionDigits: 1 } }}
      y={{ label: 'Embedding axis 2', domain: [0, 4], format: { maximumFractionDigits: 1 } }}
    />
  );
}

function NetworkMorph(): ReactNode {
  const [shown, setShown] = useState<'network' | 'embedding'>('network');

  return (
    <div {...stylex.props(styles.stack)}>
      <SegmentedControl.Root
        value={shown}
        onValueChange={(value) => setShown(value === 'embedding' ? 'embedding' : 'network')}
        aria-label="Figure"
      >
        <SegmentedControl.Item value="network">Network</SegmentedControl.Item>
        <SegmentedControl.Item value="embedding">Embedding</SegmentedControl.Item>
      </SegmentedControl.Root>
      <MorphScope figures={{ network: <Network />, embedding: <Embedding /> }} show={shown} tones={unitTones} />
    </div>
  );
}

export const NetworkToPoints: Story = { render: () => <NetworkMorph /> };

export const Instant: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Pace `instant` swaps the figures at once, exactly as every pace does for a reader who asked for reduced motion.',
      },
    },
  },
  render: () => <CardsMorph pace="instant" />,
};

export const Narrow: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <CardsMorph />
    </div>
  ),
};

/** Figures keyed by any name, so a story can name one that is missing. */
const looseFigures: Readonly<Record<string, ReactNode>> = { network: <Network />, embedding: <Embedding /> };

export const UnknownFigure: Story = { render: () => <MorphScope figures={looseFigures} show="graph" /> };

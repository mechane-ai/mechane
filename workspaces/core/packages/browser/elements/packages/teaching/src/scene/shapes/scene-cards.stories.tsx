import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sparkline } from '../../../../charts/src/cartesian/index.ts';
import type { TimeSeries } from '../../../../charts/src/cartesian/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { Button } from '../../../../core/src/index.ts';
import { SegmentedControl } from '../../../../forms/src/index.ts';
import { Scene } from '../scene.tsx';
import { SceneCard } from './scene-card.tsx';
import type { CardRank, CardSuit } from './scene-card.tsx';
import { SceneSlot } from './scene-slot.tsx';
import { SceneStack } from './scene-stack.tsx';
import type { StackLayout } from './stack-layout.ts';

const NARROW_WIDTH = 320;
const STORY_GAP = 24;
const ACTIONS_GAP = 8;

const styles = stylex.create({
  list: { display: 'grid', gap: STORY_GAP },
  narrow: { width: NARROW_WIDTH },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: ACTIONS_GAP },
});

const meta = {
  title: 'Teaching/SceneCards',
  component: SceneCard,
  parameters: {
    docs: {
      description: {
        component:
          'Playing cards for a Scene. SceneCard is a node shaped like a card that flips, lifts and tilts; SceneStack lays the cards it lists out as a pile, a fan, a row or a column; SceneSlot is a labelled bay. Describe where each card is and which way it faces, and cards deal, flip and travel by themselves. The author supplies ids, ranks and suits (or text), and one stack per place. The cards here are synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

type Playing = { readonly id: string; readonly rank: CardRank; readonly suit: CardSuit };

const hand: ReadonlyArray<Playing> = [
  { id: 'card-1', rank: 'Q', suit: 'heart' },
  { id: 'card-2', rank: 'K', suit: 'spade' },
  { id: 'card-3', rank: 'A', suit: 'diamond' },
  { id: 'card-4', rank: '7', suit: 'club' },
  { id: 'card-5', rank: 'J', suit: 'heart' },
  { id: 'card-6', rank: '3', suit: 'spade' },
];

const ids = hand.map((card) => card.id);

type DealStep = {
  readonly id: string;
  readonly label: string;
  readonly deck: ReadonlyArray<string>;
  readonly row: ReadonlyArray<string>;
  readonly bay: ReadonlyArray<string>;
  readonly faceUp: ReadonlyArray<string>;
};

const steps: ReadonlyArray<DealStep> = [
  { id: 'deck', label: 'Deck', deck: ids, row: [], bay: [], faceUp: [] },
  { id: 'deal', label: 'Deal three', deck: ids.slice(0, 3), row: ids.slice(3), bay: [], faceUp: [] },
  { id: 'flip', label: 'Flip one', deck: ids.slice(0, 3), row: ids.slice(3), bay: [], faceUp: ['card-5'] },
  {
    id: 'bay',
    label: 'Move to the bay',
    deck: ids.slice(0, 3),
    row: ['card-4', 'card-6'],
    bay: ['card-5'],
    faceUp: ['card-5'],
  },
  { id: 'return', label: 'Return all', deck: ids, row: [], bay: [], faceUp: [] },
];

const DECK_AT = [0.7, 1] as const;
const ROW_AT = [3.1, 1] as const;
const BAY_AT = [5.3, 1] as const;

function DealTable({ initial = 0 }: { readonly initial?: number }): ReactNode {
  const [index, setIndex] = useState(initial);
  const step = steps[index] ?? steps[0];

  if (step === undefined) {
    return null;
  }

  return (
    <Scene
      title="Dealing three cards"
      description={`Synthetic cards. Step: ${step.label}. A deck of six cards face down, a row where three are dealt, and a bay for the chosen one.`}
      locale="en-US"
      x={[0, 6]}
      y={[0, 2]}
      height="tall"
      actions={
        <div {...stylex.props(styles.actions)}>
          <Button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
            Back
          </Button>
          <Button onClick={() => setIndex(Math.min(steps.length - 1, index + 1))} disabled={index === steps.length - 1}>
            {index === steps.length - 1 ? 'Done' : `Next: ${steps[index + 1]?.label ?? ''}`}
          </Button>
        </div>
      }
    >
      <SceneSlot
        id="bay-slot"
        at={BAY_AT}
        text="Bay A"
        label={`Bay A, ${step.bay.length === 0 ? 'empty' : 'holding the chosen card'}`}
        isActive={step.bay.length > 0}
      />
      <SceneStack
        id="deck"
        at={DECK_AT}
        layout="pile"
        cards={step.deck}
        stagger="short"
        label={`The deck, ${step.deck.length} cards`}
      />
      <SceneStack id="row" at={ROW_AT} layout="row" cards={step.row} stagger="regular" />
      <SceneStack id="bay" at={BAY_AT} layout="pile" cards={step.bay} />
      {hand.map((card) => (
        <SceneCard
          key={card.id}
          id={card.id}
          rank={card.rank}
          suit={card.suit}
          isFaceUp={step.faceUp.includes(card.id)}
        />
      ))}
    </Scene>
  );
}

export const Deal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Step through the deal with the buttons. Each step is one state: which stack lists which card, and which cards face up. Nothing describes a motion, yet cards travel between stacks, flip through a mid-turn, and the cards a stack takes in one step set off one after another by its `stagger`; a card that moves alone sets off at once.',
      },
    },
  },
  render: () => <DealTable />,
};

const layouts = ['pile', 'fan', 'row', 'column'] as const;

const layoutIds: Readonly<Record<string, StackLayout | undefined>> = {
  pile: 'pile',
  fan: 'fan',
  row: 'row',
  column: 'column',
};

function FanTable(): ReactNode {
  const [layout, setLayout] = useState<StackLayout>('fan');
  const [isReversed, setReversed] = useState(false);
  const shown = hand.slice(0, 4);
  const order = isReversed ? shown.toReversed() : shown;

  return (
    <Scene
      title="One hand, four arrangements"
      description="Synthetic cards. The same four cards as a pile, a fan, a row or a column; reversing the order swaps their places."
      locale="en-US"
      x={[0, 4]}
      y={[0, 2]}
      height="tall"
      actions={
        <div {...stylex.props(styles.actions)}>
          <SegmentedControl.Root
            value={layout}
            onValueChange={(value) => setLayout(layoutIds[value] ?? 'fan')}
            aria-label="Arrangement"
          >
            {layouts.map((name) => (
              <SegmentedControl.Item key={name} value={name}>
                {name}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <Button onClick={() => setReversed(!isReversed)}>Reverse order</Button>
        </div>
      }
    >
      <SceneStack
        id="hand"
        at={[2, 1]}
        layout={layout}
        gap="small"
        size={layout === 'column' ? 'small' : 'medium'}
        cards={order.map((card) => card.id)}
        label={`The hand as a ${layout}`}
      />
      {shown.map((card) => (
        <SceneCard key={card.id} id={card.id} rank={card.rank} suit={card.suit} />
      ))}
    </Scene>
  );
}

const table: ReadonlyArray<Playing> = [
  { id: 'left', rank: 'Q', suit: 'heart' },
  { id: 'middle', rank: '7', suit: 'club' },
  { id: 'right', rank: 'A', suit: 'diamond' },
];

/** Each card turns over when pressed. The scene's selection request is the press. The app keeps which face is up. */
function PressToTurn(): ReactNode {
  const [faceUp, setFaceUp] = useState<ReadonlySet<string>>(new Set());

  function turn(id: string): void {
    setFaceUp(new Set(faceUp.has(id) ? [...faceUp].filter((up) => up !== id) : [...faceUp, id]));
  }

  return (
    <Scene
      title="Turn a card over"
      description="Synthetic cards, dealt face down. Press a card, or step to it with the arrow keys and press Enter or Space, to turn it."
      locale="en-US"
      x={[0, 3]}
      y={[0, 1]}
      height="tall"
      selected={null}
      onSelectedChange={turn}
      labels={{ press: 'Press Enter or Space to turn the card over.' }}
    >
      <SceneStack id="table" at={[1.5, 0.5]} layout="row" cards={table.map((card) => card.id)} />
      {table.map((card) => (
        <SceneCard key={card.id} id={card.id} rank={card.rank} suit={card.suit} isFaceUp={faceUp.has(card.id)} />
      ))}
    </Scene>
  );
}

export const PressToTurnOver: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A card acts when pressed through the scene’s `onSelectedChange`: a press, or Enter or Space on the keyboard cursor, asks for the card’s id, and the app turns it. `selected={null}` keeps the press an action rather than a lasting selection. A face-down card renders only its back, so neither a screen reader nor an agent can name it, and its id names a place, not the card.',
      },
    },
  },
  render: () => <PressToTurn />,
};

export const Fan: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A stack is its layout, anchor and the ids it lists. Change the layout or the order and every card eases to its new place. The fan overlaps the cards along a shallow arc.',
      },
    },
  },
  render: () => <FanTable />,
};

const layers = [
  { id: 'layer-1', text: 'Layer 1', tone: 'series1', phase: 0 },
  { id: 'layer-2', text: 'Layer 2', tone: 'series3', phase: 1 },
  { id: 'layer-3', text: 'Layer 3', tone: 'series4', phase: 2 },
] as const;

function wave({ phase, tone }: { readonly phase: number; readonly tone: ChartTone }): TimeSeries {
  return {
    id: `activation-${phase}`,
    label: `Activation ${phase + 1}`,
    tone,
    points: Array.from({ length: 12 }, (_, step) => ({
      timestamp: step,
      value: 0.5 + 0.4 * Math.sin((step + phase * 2) / 2),
    })),
  };
}

function ChartFaces(): ReactNode {
  const [lifted, setLifted] = useState('layer-2');

  return (
    <Scene
      title="Cards with a chart on the face"
      description="Synthetic activations. Each card holds a small trend; the chosen layer lifts toward the reader and the others rest."
      locale="en-US"
      x={[0, 4]}
      y={[0, 2]}
      height="tall"
      actions={
        <SegmentedControl.Root value={lifted} onValueChange={setLifted} aria-label="Lifted layer">
          {layers.map((layer) => (
            <SegmentedControl.Item key={layer.id} value={layer.id}>
              {layer.text}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      }
    >
      <SceneStack id="layers" at={[2, 1]} layout="row" size="large" cards={layers.map((layer) => layer.id)} />
      {layers.map((layer) => (
        <SceneCard
          key={layer.id}
          id={layer.id}
          text={layer.text}
          label={`${layer.text}, activations over twelve steps`}
          tone={layer.tone}
          lift={lifted === layer.id ? 1 : 0}
        >
          {[0, 1, 2].map((unit) => (
            <Sparkline
              key={unit}
              title={`${layer.text}, unit ${unit + 1}`}
              summary="Activation over twelve steps."
              unit="activation"
              timestampUnit="seconds"
              series={wave({ phase: layer.phase + unit, tone: layer.tone })}
              valueDomain={[0, 1]}
            />
          ))}
        </SceneCard>
      ))}
    </Scene>
  );
}

export const FaceHoldsAChart: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A card is a node, so its face can hold any Elements component. Here a trend sits under each card’s text and keeps its state while the card lifts.',
      },
    },
  },
  render: () => <ChartFaces />,
};

export const Narrow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'At 320 pixels the scene scrolls inside its own frame, and the keyboard cursor scrolls to the card it rests on.',
      },
    },
  },
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <DealTable initial={2} />
    </div>
  ),
};

export const AuthorErrors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Wrong input is reported where the author looks: a card in two stacks, a stack that lists a card that does not exist, and a card with no place.',
      },
    },
  },
  render: () => (
    <div {...stylex.props(styles.list)}>
      <Scene title="A card in two stacks" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneStack id="left" at={[1, 1]} layout="row" cards={['card-1']} />
        <SceneStack id="right" at={[3, 1]} layout="row" cards={['card-1']} />
        <SceneCard id="queen-hearts" rank="Q" suit="heart" />
      </Scene>
      <Scene title="A stack that lists a missing card" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneStack id="deck" at={[2, 1]} layout="row" cards={['card-1', 'card-3']} />
        <SceneCard id="queen-hearts" rank="Q" suit="heart" />
      </Scene>
      <Scene title="A card with no place" locale="en-US" x={[0, 4]} y={[0, 2]}>
        <SceneCard id="queen-hearts" rank="Q" suit="heart" />
      </Scene>
    </div>
  ),
};

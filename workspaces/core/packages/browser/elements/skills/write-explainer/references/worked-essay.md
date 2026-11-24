# A worked essay

The essay planned in the `plan-lesson` skill's worked plan: one neuron as a weighted vote over two playing cards. These
three files type check against the package. In the essay starter they replace `src/lesson.ts` and `src/figures.tsx`, and
the third file is the TSX form of `src/essay.mdx`.

Notice what is absent: no `useState`, no animation loop, no SVG coordinates, no color. Each figure describes the state
the lesson is in, and the parts move when it changes.

## `lesson.ts`

The plan's params and beats as literals, with each derived value's formula written as code.

```ts
import { defineLesson } from '@mechane-ai/elements/lesson';

/** The cards of the essay. A card's rank is the number it feeds the neuron. The hands are synthetic. */
export const cards = [
  { id: 'queen-hearts', rank: 'Q', suit: 'heart', value: 12 },
  { id: 'seven-spades', rank: '7', suit: 'spade', value: 7 },
  { id: 'two-hearts', rank: '2', suit: 'heart', value: 2 },
  { id: 'king-spades', rank: 'K', suit: 'spade', value: 13 },
] as const;

/** The two cards of each hand: the heart first, then the spade. */
export const hands = {
  'queen-seven': ['queen-hearts', 'seven-spades'],
  'two-king': ['two-hearts', 'king-spades'],
} as const;

function rankOf(id: string): number {
  return cards.find((card) => card.id === id)?.value ?? 0;
}

export const lesson = defineLesson({
  id: 'card-neuron',
  title: 'A neuron is a weighted vote',
  params: {
    hand: {
      kind: 'choice',
      label: 'Hand dealt',
      value: 'queen-seven',
      options: [
        { id: 'queen-seven', label: 'Queen of Hearts, Seven of Spades' },
        { id: 'two-king', label: 'Two of Hearts, King of Spades' },
      ],
    },
    heartWeight: {
      kind: 'number',
      label: 'Weight on the heart card',
      value: 0.5,
      min: -1,
      max: 1,
      step: 0.1,
      format: { maximumFractionDigits: 1 },
    },
    spadeWeight: {
      kind: 'number',
      label: 'Weight on the spade card',
      value: 0.5,
      min: -1,
      max: 1,
      step: 0.1,
      format: { maximumFractionDigits: 1 },
    },
    bias: {
      kind: 'number',
      label: 'Bias',
      value: 0,
      min: -10,
      max: 10,
      step: 0.5,
      format: { maximumFractionDigits: 1 },
    },
  },
  derived: {
    sum: {
      label: 'Weighted sum',
      format: { maximumFractionDigits: 1 },
      from: ({ hand, heartWeight, spadeWeight, bias }) =>
        rankOf(hands[hand][0]) * heartWeight + rankOf(hands[hand][1]) * spadeWeight + bias,
    },
    yes: {
      label: 'Chance the neuron says yes',
      format: { style: 'percent', maximumFractionDigits: 0 },
      from: ({ sum }) => 1 / (1 + Math.exp(-sum)),
    },
  },
  beats: [
    {
      id: 'hand',
      title: 'Two cards, two numbers',
      goal: 'Read each card as a number, its rank: an ace is 1, a queen 12, a king 13.',
      misconception: 'That the suit changes the number; the suit only says which input the card is.',
      states: [
        { id: 'queen-seven', label: 'Queen and seven', values: { hand: 'queen-seven' } },
        { id: 'two-king', label: 'Two and king', values: { hand: 'two-king' } },
      ],
    },
    {
      id: 'weights',
      title: 'Each card gets a weight',
      goal: 'See that a weight scales its card: at 0.5 the queen counts as 6, and below zero it counts against.',
      misconception: 'That a weight is the card’s value; it is how much the value counts.',
      hints: ['Drag the heart weight below zero and watch the wire turn.'],
      states: [
        { id: 'even', label: 'Both weights 0.5', values: { heartWeight: 0.5 } },
        { id: 'against', label: 'Hearts count against', values: { heartWeight: -0.5 } },
      ],
    },
    {
      id: 'sum',
      title: 'The neuron adds the votes',
      goal: 'Compute the weighted sum of one hand by hand, then check it against the figure.',
      states: [
        { id: 'balanced', label: 'Spade weight 0.5', values: { spadeWeight: 0.5 } },
        { id: 'spade-heavy', label: 'Spade weight 1', values: { spadeWeight: 1 } },
      ],
    },
    {
      id: 'bias',
      title: 'The bias sets the bar',
      goal: 'Connect a negative bias with a neuron that needs stronger evidence before it says yes.',
      misconception: 'That the bias is one more card; it is added whatever the hand.',
      hints: ['At a bias of −8 the cards must add about 10 more.', 'Raise the weight on the queen.'],
      states: [
        { id: 'no-bias', label: 'No bias', values: { bias: 0 } },
        { id: 'skeptic', label: 'Bias −8', values: { bias: -8 } },
      ],
    },
    {
      id: 'learning',
      title: 'Learning moves the weights',
      goal: 'See that training changes only the weights and the bias, never the cards.',
      states: [
        { id: 'before', label: 'Before training', values: { heartWeight: -0.5, spadeWeight: 0.5, bias: 0 } },
        { id: 'after', label: 'After training', values: { heartWeight: 0.8, spadeWeight: -0.2, bias: -4 } },
      ],
    },
  ],
});
```

## `figures.tsx`

Each figure reads the lesson and nothing else, so the beat sheet can draw it at any state. The cards keep their ids
across both scenes. Dragging the point in `ConfidenceScene` sets the bias through `sets`, which keeps each move on the
param's step grid and inside its range. The hand's two stacks deal with `stagger`, so the cards leave in turn.

```tsx
import { formatValue } from '@mechane-ai/elements/charts';
import { useLesson } from '@mechane-ai/elements/lesson';
import {
  Scene,
  SceneAxes,
  SceneCard,
  SceneCells,
  SceneCurve,
  SceneNode,
  ScenePoint,
  SceneRule,
  SceneStack,
  SceneWire,
} from '@mechane-ai/elements/scene';
import type { ReactNode } from 'react';
import { cards, hands, lesson } from './lesson.ts';

const ONE_DECIMAL = { maximumFractionDigits: 1 } as const;

/** The deck and the hand. Changing `hand` deals two cards out of the deck, face up, in turn. */
export function HandScene(): ReactNode {
  const { values, locale } = useLesson(lesson);
  const dealt: ReadonlyArray<string> = hands[values.hand];
  const deck = cards.flatMap((card) => (dealt.includes(card.id) ? [] : [card.id]));

  return (
    <Scene
      title="The hand"
      description="Four synthetic cards: two dealt face up into the hand, two face down in the deck."
      locale={locale}
      x={[0, 4]}
      y={[0, 2]}
      height="tall"
    >
      <SceneStack id="deck" at={[0.8, 1]} cards={deck} stagger="short" label="The deck, two cards face down" />
      <SceneStack
        id="dealt"
        at={[2.8, 1]}
        layout="row"
        cards={dealt}
        stagger="regular"
        label="The hand, two cards face up"
      />
      {cards.map((card) => (
        <SceneCard key={card.id} id={card.id} rank={card.rank} suit={card.suit} isFaceUp={dealt.includes(card.id)} />
      ))}
    </Scene>
  );
}

/** Each card wired to the sum; a wire's thickness is its weight and its hue the weight's sign. */
export function VoteScene(): ReactNode {
  const { values, locale } = useLesson(lesson);
  const [heartId, spadeId] = hands[values.hand];
  const heart = cards.find((card) => card.id === heartId) ?? cards[0];
  const spade = cards.find((card) => card.id === spadeId) ?? cards[1];
  const sum = formatValue({ value: values.sum, locale, format: ONE_DECIMAL });

  return (
    <Scene
      title="The weighted vote"
      description="Each card's rank times its weight flows into one sum. Thicker wires count more; a negative weight counts against."
      locale={locale}
      x={[0, 4]}
      y={[0, 2]}
      height="tall"
    >
      <SceneCard id={heart.id} at={[0.6, 1.5]} rank={heart.rank} suit={heart.suit} size="small" />
      <SceneCard id={spade.id} at={[0.6, 0.5]} rank={spade.rank} suit={spade.suit} size="small" />
      <SceneNode id="sum" at={[3.2, 1]} shape="circle" text={sum} label={`The weighted sum, ${sum}`} />
      {[
        { card: heart, weight: values.heartWeight },
        { card: spade, weight: values.spadeWeight },
      ].map(({ card, weight }) => {
        const text = formatValue({ value: weight, locale, format: ONE_DECIMAL });

        return (
          <SceneWire
            key={card.id}
            from={card.id}
            to="sum"
            weight={weight}
            text={`× ${text}`}
            label={`Rank ${card.value} counts with weight ${text}`}
          />
        );
      })}
    </Scene>
  );
}

function sigmoid(sum: number): number {
  return 1 / (1 + Math.exp(-sum));
}

/** How sure the neuron is at each bias, for the cards and weights it has. Dragging the point sets the bias. */
export function ConfidenceScene(): ReactNode {
  const { values, locale } = useLesson(lesson);
  const fromCards = values.sum - values.bias;
  const chance = (bias: number): number => sigmoid(fromCards + bias);
  const bias = formatValue({ value: values.bias, locale, format: ONE_DECIMAL });
  const yes = formatValue({ value: values.yes, locale, format: { style: 'percent', maximumFractionDigits: 0 } });

  return (
    <Scene
      title="How sure the neuron is"
      description="The chance of saying yes at each bias, for the current cards and weights. The curve shifts when a weight changes."
      locale={locale}
      x={[-10, 10]}
      y={[0, 1]}
    >
      <SceneAxes x={{ label: 'Bias' }} y={{ label: 'Chance of yes', format: { style: 'percent' } }} />
      <SceneCurve id="chance" of={chance} resolution="fine" label="The chance of yes at each bias" />
      <SceneRule id="even" y={0.5} text="even" label="An even chance" />
      <ScenePoint
        id="now"
        at={[values.bias, values.yes]}
        along={chance}
        sets={{ x: 'bias' }}
        label={`Bias ${bias}, chance of yes ${yes}. Move it to change the bias.`}
      />
    </Scene>
  );
}

/** The weights and the bias as cells, shaded around zero. */
export function WeightCells(): ReactNode {
  const { values, locale } = useLesson(lesson);

  return (
    <Scene
      title="What training changes"
      description="The two weights and the bias, shaded one hue above zero and another below."
      locale={locale}
      x={[0, 2]}
      y={[0, 1]}
      height="compact"
    >
      <SceneCells
        id="weights"
        at={[1, 0.5]}
        values={[values.heartWeight, values.spadeWeight, values.bias / 10]}
        columnLabels={['heart weight', 'spade weight', 'bias ÷ 10']}
        palette="diverging"
        domain={[-1, 1]}
        format={ONE_DECIMAL}
        label="The heart weight, the spade weight and the bias"
      />
    </Scene>
  );
}
```

## `essay.tsx`

Every `Beat`, `Figure`, `Param`, `Predict` and `Challenge` is written as markup the article can walk: plain elements and
fragments, not a component of your own. The beats are one exported fragment, so the tutor in the `tutor.md` reference
reads the same markup through `articleOutline`. Each `Figure` lists the values its component reads. The prediction comes
before the figure that answers it.

```tsx
import { Article, Beat, Challenge, Figure, Predict, Scrolly, ScrollyStep, Term } from '@mechane-ai/elements/article';
import { Param, ParamSlider, Value } from '@mechane-ai/elements/lesson';
import { LessonFlow } from '@mechane-ai/elements/scene';
import type { ReactNode } from 'react';
import { ConfidenceScene, HandScene, VoteScene, WeightCells } from './figures.tsx';
import { lesson } from './lesson.ts';

/** The beats, written once. The article arranges them, and `articleOutline` reads them for the tutor. */
export const cardNeuronBeats = (
  <>
    <Beat id="hand">
      <p>
        A neuron reads numbers. Ours reads two playing cards, each as its rank. Deal a hand: <Param name="hand" />.
      </p>
      <Predict
        id="bigger-hand"
        prompt="Which hand adds up to more, before any weights?"
        options={[
          { id: 'queen-seven', label: 'Queen and seven' },
          { id: 'two-king', label: 'Two and king' },
        ]}
        answer="queen-seven"
      >
        <p>The queen and seven make 19; the two and king make 15. The king alone is not enough.</p>
      </Predict>
      <Figure
        id="hand-scene"
        caption="The hand dealt from the deck."
        description="Two cards face up in a row, two face down in a pile beside them."
        reads={['hand']}
      >
        <HandScene />
      </Figure>
    </Beat>
    <Beat id="weights">
      <p>
        The neuron does not count every card the same. The <Term inspects="queen-hearts">Queen of Hearts</Term> counts
        with a weight of <Param name="heartWeight" />, and the weighted sum is now <Value name="sum" />.
      </p>
      <Predict
        id="negative-weight"
        prompt="Make the heart weight −0.5. Does the weighted sum rise or fall?"
        options={[
          { id: 'rise', label: 'It rises' },
          { id: 'fall', label: 'It falls' },
        ]}
        answer="fall"
      >
        <p>A negative weight turns the queen into evidence against: 12 × −0.5 takes 6 away.</p>
      </Predict>
      <Figure
        id="vote-scene"
        caption="Each card counts by its weight."
        description="Two cards wired to a circle holding the sum; the wire from the heart card thins and changes hue as its weight falls below zero."
        reads={['hand', 'heartWeight', 'spadeWeight', 'sum']}
      >
        <VoteScene />
      </Figure>
    </Beat>
    <Beat id="sum">
      <p>
        Give the spade a weight of <Param name="spadeWeight" />. Multiply, add, and check your sum against{' '}
        <Value name="sum" /> in the figure.
      </p>
      <Figure
        id="sum-flow"
        caption="The sum, wired to every value it reads."
        description="Boxes for the hand, the two weights and the bias, each wired into the weighted sum."
        reads={['sum']}
      >
        <LessonFlow description="Each value, wired to the values it reads." names={['sum']} />
      </Figure>
    </Beat>
    <Beat id="bias">
      <p>
        The bias is added whatever the hand. At a bias of <Param name="bias" /> the neuron says yes with a chance of{' '}
        <Value name="yes" />.
      </p>
      <Figure
        id="confidence"
        caption="The sigmoid turns the sum into a chance. Drag the point to move the bias."
        description="An S-shaped curve of the chance of yes against the bias, with a point at the current bias."
        reads={['sum', 'yes', 'bias']}
      >
        <ConfidenceScene />
        <ParamSlider name="bias" />
      </Figure>
      <Challenge
        id="skeptic"
        prompt="With a bias of −8, make the neuron at least 90% sure for the queen and seven."
        isReached={(values) => values['bias'] === -8 && Number(values['yes']) >= 0.9}
        hints={['At a bias of −8 the cards must add about 10 more.', 'Raise the weight on the queen.']}
      >
        <p>A skeptical neuron needs strong evidence: the weights must outvote the bias.</p>
      </Challenge>
    </Beat>
    <Beat id="learning">
      <Scrolly
        figure={
          <Figure
            id="weight-cells"
            caption="The weights and the bias."
            description="Three cells: the heart weight, the spade weight and the bias, shaded by sign."
            reads={['heartWeight', 'spadeWeight', 'bias']}
          >
            <WeightCells />
          </Figure>
        }
      >
        <ScrollyStep id="before" state="before">
          <p>Before training, the neuron counts hearts against and spades a little for.</p>
        </ScrollyStep>
        <ScrollyStep id="after" state="after">
          <p>Training moved only these three numbers. The cards never changed.</p>
        </ScrollyStep>
      </Scrolly>
    </Beat>
  </>
);

export function CardNeuronEssay(): ReactNode {
  return (
    <Article
      lesson={lesson}
      locale="en-US"
      title="A neuron is a weighted vote"
      summary="Two playing cards, two weights and a bias: everything one artificial neuron does. The hands are synthetic."
      tones={{
        'queen-hearts': 'negative',
        'two-hearts': 'negative',
        'seven-spades': 'series1',
        'king-spades': 'series1',
      }}
      storageKey="card-neuron"
    >
      {cardNeuronBeats}
    </Article>
  );
}
```

## Check it

- `/?view=sheet` shows each beat twice, once per state. The `weights` row should show the heart wire flip sign; the
  `bias` row should show the point slide down the curve.
- `/?view=static` prints each beat at its first state, the predictions with a "Show the answer" disclosure and each
  scrolly step with the cells at that step's state.
- `checkLesson(lesson)` returns no findings.

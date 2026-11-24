import {
  Article,
  Aside,
  Beat,
  Challenge,
  Figure,
  FigureReference,
  Footnote,
  Predict,
  Reveal,
  Scrolly,
  ScrollyStep,
  Term,
  useRevealed,
} from '@mechane-ai/elements/article';
import type { ArticleView } from '@mechane-ai/elements/article';
import type { ChartTone } from '@mechane-ai/elements/charts';
import { BarChart } from '@mechane-ai/elements/charts/cartesian';
import { CurveChart } from '@mechane-ai/elements/charts/trend';
import { defineLesson, Param, ParamChoice, Playback, Transport, useLesson, Value } from '@mechane-ai/elements/lesson';
import {
  LessonFlow,
  MorphScope,
  Scene,
  SceneAxes,
  SceneCard,
  SceneCells,
  SceneCurve,
  SceneNode,
  ScenePoint,
  SceneRule,
  SceneSlot,
  SceneStack,
  SceneWire,
} from '@mechane-ai/elements/scene';
import type { CardRank, CardSuit, SceneCellInput } from '@mechane-ai/elements/scene';
import { spacing } from '@mechane-ai/elements/tokens';
import type { ReactNode } from 'react';

type Card = { readonly id: string; readonly rank: CardRank; readonly suit: CardSuit };

const suits = [
  { id: 'heart', label: 'Hearts', glyph: '♥' },
  { id: 'diamond', label: 'Diamonds', glyph: '♦' },
  { id: 'spade', label: 'Spades', glyph: '♠' },
  { id: 'club', label: 'Clubs', glyph: '♣' },
] as const;

/** A synthetic twelve-card deck, three faces of each suit, in one fixed shuffled order. */
const deck = [
  { id: 'spade:K', rank: 'K', suit: 'spade' },
  { id: 'heart:Q', rank: 'Q', suit: 'heart' },
  { id: 'club:J', rank: 'J', suit: 'club' },
  { id: 'spade:Q', rank: 'Q', suit: 'spade' },
  { id: 'heart:K', rank: 'K', suit: 'heart' },
  { id: 'diamond:J', rank: 'J', suit: 'diamond' },
  { id: 'club:Q', rank: 'Q', suit: 'club' },
  { id: 'spade:J', rank: 'J', suit: 'spade' },
  { id: 'diamond:K', rank: 'K', suit: 'diamond' },
  { id: 'heart:J', rank: 'J', suit: 'heart' },
  { id: 'diamond:Q', rank: 'Q', suit: 'diamond' },
  { id: 'club:K', rank: 'K', suit: 'club' },
] as const satisfies ReadonlyArray<Card>;

/** The faces of each suit; in the count chart each is one segment of its suit's bar. */
const faces = [
  { rank: 'J', label: 'Jack', tone: 'series3' },
  { rank: 'Q', label: 'Queen', tone: 'series5' },
  { rank: 'K', label: 'King', tone: 'series6' },
] as const;

const PER_SUIT = faces.length;
const EVEN = 1 / suits.length;
const LAST_DEAL = deck.length - 1;
const LOW_SURPRISE = 0.5;
const PAGE_WIDTH = 1200;

/** The page's own gutter: an article fills what it is given and leaves the edges to the page. */
const pageStyle = {
  boxSizing: 'border-box',
  maxWidth: PAGE_WIDTH,
  margin: '0 auto',
  padding: `${spacing.xxl} ${spacing.lg}`,
} as const;

const whole = { maximumFractionDigits: 0 } as const;
const percent = { style: 'percent', maximumFractionDigits: 0 } as const;
const bits = { style: 'unit', unit: 'bit', unitDisplay: 'long', maximumFractionDigits: 2 } as const;

/** The hue of each suit, shared by every card, chart and term of the essay. */
const suitTones: Readonly<Record<CardSuit, ChartTone>> = {
  heart: 'negative',
  diamond: 'series4',
  spade: 'series1',
  club: 'series2',
};

const cardTones: Readonly<Record<string, ChartTone>> = Object.fromEntries(
  deck.map((card) => [card.id, suitTones[card.suit]]),
);

/** The card dealt after `dealt` cards: the one the model is scored on. */
function nextCard(dealt: number): Card {
  return deck[dealt] ?? deck[0];
}

/** How many cards of each suit the first `dealt` cards hold, in the order of `suits`. */
function seenCounts(dealt: number): ReadonlyArray<number> {
  const seen = deck.slice(0, dealt);

  return suits.map((suit) => seen.filter((card) => card.suit === suit.id).length);
}

/** The chance the model gives each suit: the weighted share of what is left, plus the rest spread evenly. */
function chances({ dealt, trust }: { readonly dealt: number; readonly trust: number }): ReadonlyArray<number> {
  const remaining = deck.length - dealt;

  return seenCounts(dealt).map((seen) => (trust * (PER_SUIT - seen)) / remaining + (1 - trust) * EVEN);
}

/** The counts by suit as a sentence, such as "2 hearts, 1 diamonds". */
function spoken(counts: ReadonlyArray<number>): string {
  return suits.map((suit, index) => `${counts[index] ?? 0} ${suit.label.toLowerCase()}`).join(', ');
}

/** One column of counts, one cell per suit, each read out with its suit's name and what the count is. */
function suitColumn(counts: ReadonlyArray<number>, word: string): ReadonlyArray<ReadonlyArray<SceneCellInput>> {
  return suits.map((suit, index) => {
    const count = counts[index] ?? 0;

    return [{ value: count, label: `${suit.label} ${word}: ${count}` }];
  });
}

/** The chance of the next suit at each weight, for a share by the count. */
function weightedLine(share: number): (weight: number) => number {
  return (weight) => weight * share + (1 - weight) * EVEN;
}

function suitLeft(dealt: number): number {
  const { suit } = nextCard(dealt);

  return deck.slice(dealt).filter((card) => card.suit === suit).length;
}

function surpriseAt({ dealt, trust }: { readonly dealt: number; readonly trust: number }): number {
  const share = suitLeft(dealt) / (deck.length - dealt);

  return -Math.log2(trust * share + (1 - trust) * EVEN);
}

/** Counting cards: a model that counts the dealt cards guesses the next suit better. The deck is synthetic. */
export const countingLesson = defineLesson({
  id: 'counting-cards',
  title: 'Counting cards',
  params: {
    dealt: { kind: 'number', label: 'Cards dealt', value: 0, min: 0, max: LAST_DEAL, step: 1, format: whole },
    trust: {
      kind: 'number',
      label: 'Weight on the count',
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      format: { maximumFractionDigits: 2 },
    },
    isNextShown: { kind: 'toggle', label: 'Next card face up', value: false },
    arrangement: {
      kind: 'choice',
      label: 'Arrangement',
      value: 'table',
      options: [
        { id: 'table', label: 'On the table' },
        { id: 'counts', label: 'Counted by suit' },
      ],
    },
  },
  derived: {
    cardsLeft: { label: 'Cards left', format: whole, from: ({ dealt }) => deck.length - dealt },
    suitLeft: { label: 'Left of the next suit', format: whole, from: ({ dealt }) => suitLeft(dealt) },
    share: { label: 'Share by the count', format: percent, from: (values) => values.suitLeft / values.cardsLeft },
    chance: {
      label: 'Chance of the next suit',
      format: percent,
      from: (values) => values.trust * values.share + (1 - values.trust) * EVEN,
    },
    surprise: { label: 'Surprise', format: bits, from: (values) => -Math.log2(values.chance) },
  },
  beats: [
    {
      id: 'deck',
      title: 'A deck, one card at a time',
      goal: 'See that each dealt card leaves a smaller deck with a different mix of suits.',
      states: [
        { id: 'fresh', label: 'A fresh deck', values: { dealt: 0 } },
        { id: 'four', label: 'Four dealt', values: { dealt: 4 } },
        { id: 'eight-up', label: 'Eight dealt, next face up', values: { dealt: 8, isNextShown: true } },
      ],
    },
    {
      id: 'count',
      title: 'The model keeps a count',
      goal: 'Read the count of what is left as the feature the model guesses from.',
      misconception: 'That the model remembers the order of the cards; it only keeps four numbers.',
      steps: 2,
      states: [
        { id: 'early', label: 'Two dealt', values: { dealt: 2 } },
        { id: 'late', label: 'Nine dealt', values: { dealt: 9 } },
      ],
    },
    {
      id: 'readout',
      title: 'From a count to a chance',
      goal: 'Connect the weight on the count with how far the chance moves from an even guess.',
      hints: ['Set the weight to 0 and the chance is always 25%.', 'Set it to 1 and the chance is the share left.'],
      states: [
        { id: 'half', label: 'Weight one half', values: { dealt: 5, trust: 0.5 } },
        { id: 'even', label: 'Weight 0', values: { dealt: 5, trust: 0 } },
        { id: 'counter', label: 'Weight 1', values: { dealt: 5, trust: 1 } },
      ],
    },
    {
      id: 'counted',
      title: 'The same cards, counted',
      goal: 'See the count as the dealt cards themselves, sorted by suit.',
      states: [
        { id: 'table', label: 'On the table', values: { dealt: 8 } },
        { id: 'counts', label: 'Counted by suit', values: { dealt: 8, arrangement: 'counts' } },
      ],
    },
    {
      id: 'practice',
      title: 'Play the deal',
      goal: 'Find that counting helps most near the end of the deck.',
      misconception: 'That counting lowers the surprise on every card; on a rare suit it raises it.',
      steps: 1,
      states: [
        { id: 'start', label: 'First card, weight 1', values: { dealt: 0, trust: 1 } },
        { id: 'end', label: 'Last card, weight 1', values: { dealt: LAST_DEAL, trust: 1 } },
      ],
    },
  ],
});

/** The deck, the next card and the table, at the lesson's deal. */
function DealScene(): ReactNode {
  const { values, locale } = useLesson(countingLesson);
  const { dealt, isNextShown } = values;
  const table = deck.slice(0, dealt);
  const next = nextCard(dealt);
  const rest = deck.slice(dealt + 1);

  return (
    <Scene
      title="The deal"
      description={`Synthetic deck. ${dealt} of ${deck.length} cards are on the table, one waits face ${isNextShown ? 'up' : 'down'} and ${rest.length} stay in the deck.`}
      locale={locale}
      x={[0, 2]}
      y={[0, 2]}
      height="regular"
    >
      <SceneSlot
        id="next-slot"
        size="small"
        at={[1.4, 2]}
        text="Next card"
        label="The next card, the one the model guesses"
      />
      <SceneStack
        id="deck"
        size="small"
        at={[0.6, 2]}
        cards={rest.map((card) => card.id)}
        label={`The deck, ${rest.length} cards`}
      />
      <SceneStack id="next" size="small" at={[1.4, 2]} cards={[next.id]} />
      <SceneStack
        id="table"
        at={[1, 0]}
        layout="fan"
        size="small"
        gap="small"
        stagger="regular"
        cards={table.map((card) => card.id)}
        label={`The table, ${table.length} cards dealt`}
      />
      {deck.map((card, index) => (
        <SceneCard
          key={card.id}
          id={card.id}
          rank={card.rank}
          suit={card.suit}
          isFaceUp={index < dealt || (index === dealt && isNextShown)}
        />
      ))}
    </Scene>
  );
}

/** The count as a pipeline: the suits seen, what is left, and the chances the model reads out. */
function CountScene(): ReactNode {
  const { values, locale } = useLesson(countingLesson);
  const seen = seenCounts(values.dealt);
  const left = seen.map((count) => PER_SUIT - count);
  const guess = chances(values);
  const isLeftShown = useRevealed(1);
  const isGuessShown = useRevealed(2);
  const glyphs = suits.map((suit) => suit.glyph);

  return (
    <Scene
      title="From the cards seen to a guess"
      description={`Synthetic deck after ${values.dealt} cards. Seen: ${spoken(seen)}. Left: ${spoken(left)}.`}
      locale={locale}
      x={[0, 2]}
      y={[0, 2]}
      height="regular"
    >
      <SceneCells
        id="seen"
        at={[0, 1]}
        cells={suitColumn(seen, 'seen')}
        columnLabels={['Seen']}
        rowLabels={glyphs}
        size="small"
        palette="sequential"
        domain={[0, PER_SUIT]}
        format={whole}
        label={`Cards seen: ${spoken(seen)}`}
      />
      <SceneCells
        id="left"
        at={[0.5, 1]}
        cells={suitColumn(left, 'left')}
        columnLabels={['Left']}
        size="small"
        palette="sequential"
        domain={[0, PER_SUIT]}
        format={whole}
        isShown={isLeftShown}
        label={`Cards left: ${spoken(left)}`}
      />
      <SceneNode
        id="guess"
        at={[2, 1]}
        size={{ width: 260, height: 230 }}
        label="The chance the model gives each suit for the next card"
        isShown={isGuessShown}
      >
        <BarChart
          title="The model’s chances"
          locale={locale}
          categories={suits.map((suit) => ({ id: suit.id, label: suit.glyph }))}
          series={[{ id: 'chance', label: 'Chance of the suit', tone: 'series1', values: guess }]}
          domain={[0, 1]}
          valueFormat={percent}
          valueLabel="Chance"
          height="compact"
        />
      </SceneNode>
      <SceneWire
        from="seen"
        to="left"
        text="3 − seen"
        label="Three of each suit, minus what was seen"
        isShown={isLeftShown}
      />
      <SceneWire
        from="left"
        to="guess"
        text="weighted share"
        label="A weighted share of what is left"
        isShown={isGuessShown}
      />
    </Scene>
  );
}

/** The chance the model gives the next suit, as a line over the weight, with a point the reader drags. */
function ChancePlane(): ReactNode {
  const { values, locale } = useLesson(countingLesson);
  const line = weightedLine(values.share);

  return (
    <Scene
      title="Chance by weight"
      description={`A straight line from an even 25% at weight 0 to the share by the count, ${Math.round(values.share * 100)}%, at weight 1. Drag the point to set the weight.`}
      locale={locale}
      x={[0, 1]}
      y={[0, 1]}
      height="regular"
    >
      <SceneAxes
        x={{ label: 'Weight on the count', format: { maximumFractionDigits: 1 } }}
        y={{ label: 'Chance', format: percent }}
      />
      <SceneRule id="even" y={EVEN} text="Even guess" />
      <SceneCurve id="chance-line" of={line} label="The chance of the next suit at every weight" tone="series1" />
      <ScenePoint
        id="weight"
        at={[values.trust, values.chance]}
        along={line}
        sets={{ x: 'trust' }}
        label={`Weight ${values.trust.toFixed(2)}, chance ${Math.round(values.chance * 100)}%`}
        tone="series1"
      />
    </Scene>
  );
}

/** The dealt cards, as the table shows them or counted by suit. Each card keeps its id in both. */
function CountedCards(): ReactNode {
  const { values, locale } = useLesson(countingLesson);
  const table = deck.slice(0, values.dealt);

  const counts = (
    <BarChart
      title="Cards seen by suit"
      description="The dealt cards stacked by suit, one segment per card: a bar's height is the count."
      locale={locale}
      categories={suits.map((suit) => ({ id: suit.id, label: suit.label }))}
      series={faces.map((face) => ({
        id: face.rank,
        label: face.label,
        tone: face.tone,
        values: suits.map((suit) => (table.some((card) => card.id === `${suit.id}:${face.rank}`) ? 1 : 0)),
      }))}
      mode="stacked"
      domain={[0, PER_SUIT]}
      valueFormat={whole}
      valueLabel="Cards"
      height="tall"
    />
  );

  return <MorphScope figures={{ table: <DealScene />, counts }} show={values.arrangement} tones={cardTones} />;
}

/** The model's surprise at each card of the deal, at the current weight and for an even guess. */
function SurpriseCurve(): ReactNode {
  const { values, locale } = useLesson(countingLesson);
  const deals = deck.map((_, dealt) => dealt);

  return (
    <CurveChart
      title="Surprise across the deal"
      description="Synthetic deck. The counting model's surprise at each next card, against an even guess's constant two bits."
      locale={locale}
      series={[
        {
          id: 'model',
          label: 'Model',
          tone: 'series1',
          points: deals.map((dealt) => ({ x: dealt, y: surpriseAt({ dealt, trust: values.trust }) })),
        },
        { id: 'even', label: 'Even guess', tone: 'neutral', points: deals.map((dealt) => ({ x: dealt, y: 2 })) },
      ]}
      x={{ label: 'Cards dealt', domain: [0, LAST_DEAL], format: whole }}
      y={{ label: 'Surprise (bits)', domain: [0, 3], format: { maximumFractionDigits: 1 } }}
      markers={[{ x: values.dealt, label: 'Now' }]}
      labels="inline"
      height="compact"
    />
  );
}

function isLowSurprise(values: Readonly<Record<string, unknown>>): boolean {
  return Number(values['surprise']) < LOW_SURPRISE;
}

/** The essay, written once; each view arranges it. Its deck and numbers are synthetic. */
export const countingEssay = (
  <>
    <Beat id="deck">
      <p>
        Twelve cards, three of each suit, are dealt one at a time. Before each card a model guesses its suit. A guess
        that ignores the deal gives every suit 25%; a guess that counts can do better, because every dealt card changes
        what is left.
      </p>
      <Scrolly
        figure={
          <Figure
            id="deal"
            caption="The deck, the card about to be dealt, and the table."
            description="A face-down deck and, beside it, one card in the next-card bay; below them the dealt cards fan out face up."
            reads={['dealt', 'isNextShown']}
          >
            <DealScene />
          </Figure>
        }
      >
        <ScrollyStep id="fresh" values={{ dealt: 0, isNextShown: false }}>
          <p>
            <strong>A fresh deck.</strong> Nothing is dealt, so every suit is equally likely next.
          </p>
        </ScrollyStep>
        <ScrollyStep id="four" values={{ dealt: 4, isNextShown: false }}>
          <p>
            <strong>Four dealt.</strong> Two spades and two hearts are gone, so diamonds and clubs are now more likely.
          </p>
        </ScrollyStep>
        <ScrollyStep id="eight" values={{ dealt: 8, isNextShown: true }}>
          <p>
            <strong>Eight dealt.</strong> Only four cards remain. Turn the next card face up or down:{' '}
            <Param name="isNextShown" />.
          </p>
        </ScrollyStep>
      </Scrolly>
    </Beat>
    <Beat id="count">
      <p>
        The model never sees the order of the deal. After <Param name="dealt" /> cards it keeps four numbers, the suits
        seen so far, and from them <Term inspects="left">what is left</Term> of each suit (
        <FigureReference to="count-pipeline" />
        ).
      </p>
      <Figure
        id="count-pipeline"
        caption="The count becomes the model’s guess, one step at a time."
        description="Three parts joined by arrows: four cells counting the suits seen, four cells counting the suits left, and a bar chart of the chance the model gives each suit."
        reads={['dealt', 'trust']}
      >
        <CountScene />
      </Figure>
      <Reveal at={1}>
        <p>
          Subtracting from three gives the cards left of each suit; <Value name="cardsLeft" /> cards remain in all.
        </p>
      </Reveal>
      <Reveal at={2}>
        <p>
          <Term inspects="guess">The model’s chances</Term> mix that count with an even guess.
          <Footnote id="blackjack">
            Blackjack players count cards the same way, keeping one running number instead of four.
          </Footnote>
        </p>
      </Reveal>
    </Beat>
    <Beat id="readout">
      <p>
        The weight on the count, now <Param name="trust" />, decides how much the model believes it. The chance is the
        weight times the share by the count, plus the rest of the weight spread evenly over four suits.
      </p>
      <Predict
        id="chance-guess"
        prompt="Before you look at the figures: what chance does the model give the suit that comes next?"
        min={0}
        max={1}
        step={0.05}
        format={percent}
        answerFrom="chance"
        tolerance={0.05}
      >
        <p>
          The next card’s suit has <Value name="suitLeft" /> of the <Value name="cardsLeft" /> cards left, so the model
          gives it <Value name="chance" />.
        </p>
      </Predict>
      <Figure
        id="chance-plane"
        caption="The chance of the next suit at every weight; drag the point."
        description="A straight line from 25% at weight 0 to the share by the count at weight 1, with a dashed rule at 25% and a point at the current weight."
        reads={['trust', 'dealt']}
      >
        <ChancePlane />
      </Figure>
      <Aside>Surprise is the loss a model trains on: the bits it takes to name the card that came.</Aside>
      <Figure
        id="derivation"
        caption="Every value of the lesson and what it reads."
        description="A diagram in layers: cards dealt feeds cards left and the cards left of the next suit, which give the share; with the weight they give the chance, and the chance gives the surprise."
      >
        <LessonFlow
          names={['surprise']}
          description="Synthetic deck. Each value sits one layer after what it reads."
          formula={{
            cardsLeft: '12 − dealt',
            share: 'left of suit ÷ cards left',
            chance: 'w · share + (1 − w) · ¼',
            surprise: '−log₂ chance',
          }}
        />
      </Figure>
    </Beat>
    <Beat id="counted">
      <p>
        The count is nothing but the dealt cards sorted by suit. After <Value name="dealt" /> cards, switch the figure
        between the table and the count and watch the same cards travel.
      </p>
      <Figure
        id="morph"
        caption="The dealt cards, on the table or counted by suit."
        description="The deal scene, or a stacked bar chart with one bar per suit, where each dealt card becomes one segment of its suit's bar."
        reads={['dealt']}
      >
        <CountedCards />
        <ParamChoice name="arrangement" />
      </Figure>
    </Beat>
    <Beat id="practice">
      <p>
        Play the deal with the weight at <Param name="trust" />. At card <Value name="dealt" /> the model gives the next
        suit <Value name="chance" />, a surprise of <Value name="surprise" />.
      </p>
      <Figure
        id="deal-run"
        caption="The deal played card by card, and the model’s surprise at each card."
        description="Play controls, the deal scene and a curve of the model's surprise at each of the twelve cards, against a flat line at two bits for an even guess."
        reads={['dealt', 'trust']}
      >
        <Playback name="dealt" pace="slow" />
        <Transport for="dealt" />
        <DealScene />
        <SurpriseCurve />
      </Figure>
      <Reveal at={1}>
        <p>
          With seven cards dealt the next card is the last spade, a suit the count calls unlikely: counting costs bits
          there and wins them back near the end.
        </p>
      </Reveal>
      <Challenge
        id="low-surprise"
        prompt="Make the model’s surprise at the next card less than half a bit."
        isReached={isLowSurprise}
        hints={['Deal to the last card.', 'Then put most of the weight on the count.']}
      >
        <p>
          The surprise is <Value name="surprise" />: with one card left the count names its suit for certain.
        </p>
      </Challenge>
    </Beat>
  </>
);

type CountingCardsProps = {
  readonly title: string;
  readonly summary: string;
  /** How the essay is arranged. Defaults to the scrolling essay. */
  readonly view?: ArticleView | undefined;
};

/**
 * Build an explorable essay that uses every teaching layer, from a lesson with beat states to cards that deal and flip.
 * It draws a count as cells and a chart, a plane, the derivation, a morph into a chart, a prediction and a challenge.
 * Pass a title, a summary and optionally a view.
 */
export function CountingCards({ title, summary, view }: CountingCardsProps) {
  return (
    <main style={pageStyle}>
      <Article lesson={countingLesson} locale="en-US" title={title} summary={summary} tones={suitTones} view={view}>
        {countingEssay}
      </Article>
    </main>
  );
}

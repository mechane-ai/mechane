# Scene parts

Every part below is exported from `@mechane-ai/elements/scene`, sits inside a `Scene`, takes a stable `id`, and eases
when its props change. The samples type check; they read a lesson defined in the same module (the worked essay's for the
plane and the cards).

## The plane

For a scene whose box is a coordinate plane. All positions and values are in data units.

- `SceneAxes`: `x` and `y` as `{ label, format?, ticks? }`, `grid` (`'x'`, `'y'`, `'both'` or none). Put the unit in the
  label. Leave the axes out of a diagram whose positions mean nothing.
- `SceneCurve`: `of` (a function of x) or `points` (`[x, y]` pairs, x increasing), `resolution`, `fillTo`, `isDashed`
  for a modelled curve, `thickness`. A new `of` eases from the old shape.
- `ScenePoint`: `at`, `text`, and `sets` to make it a slider: the reader drags it, or reaches it with Tab and moves it
  with the arrow keys, Home and End, and it speaks each bound value in its param's format. On a point that sets `x` and
  `y`, Left and Right move x and Up and Down move y. `sets` names the number params its position writes, as
  `{ x: 'bias' }`; a move sets them in one change, on each param's step grid and inside its range. `along` (`'x'`, `'y'`
  or a function of x) limits the move, and a point bound on one axis moves along it. `snap` sets the step of an axis no
  param owns. The point stays at `at`, read from the lesson. Reach for `onMove(position, details)` only when a move is
  not a plain param write, and set a lesson param there, never component state.
- `SceneVector`: `to`, `from` (defaults to the origin), `text`, `isDashed` for a step not yet taken.
- `SceneProjection`: `of` (a point's id) or `at`, dashed lines to both axes with the values written there.
- `SceneRegion`: one of `between` (two x values), `above`, `below` (a y value) or `points` (a polygon). Keep it pale.
- `SceneRule`: `x` or `y`, a dashed threshold or asymptote with a short `text`.

A draggable point that moves a param. `sets` keeps the bias on its step and inside its range, so there is no handler to
write:

```tsx
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
```

## Cards

- `SceneCard`: `rank` (`'A'`, `'2'` to `'10'`, `'J'`, `'Q'`, `'K'`) with `suit` (`'heart'`, `'diamond'`, `'spade'`,
  `'club'`) for a playing card, or `text` for a generic card. `isFaceUp` turns it over (default true), `lift` raises it,
  `tilt` leans it, `size` is `'small'`, `'medium'` or `'large'`, and `children` go on the face, even a chart. Its tone
  defaults to its suit's (`suitTones`), and its back stays neutral so it hides the suit. A face-down card renders only
  its back and reads "A card, face down", so leave out `label` and keep its `id` free of its rank and suit. To turn it
  when pressed, give the `Scene` `selected={null}` and `onSelectedChange` (see the scene reference). Place it with `at`,
  or list it in one `SceneStack`.
- `SceneStack`: `id`, `at`, `cards` (ids, bottom of a pile first), `layout` (`'pile'`, `'fan'`, `'row'`, `'column'`),
  `gap`, `size`, `stagger`. Move a card between stacks by moving its id from one list to the other. `stagger`
  (`'short'`, `'regular'`, `'long'`) deals in turn: cards that arrive or move in the same update start that step apart,
  in stack order, and a lone card starts at once. Use it, not a card's `delay`, to deal. A card in two stacks, or a card
  with no place, shows an error.
- `SceneSlot`: an empty bay a card is dealt to, with `text`, `size` and `isActive` for the one that matters now. A
  slot's `isActive` only draws its outline and tint; nothing else recedes.

A deal is two lists of ids. Changing the hand moves the cards, flips them and deals them in turn, with no motion code:

```tsx
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
```

## Cells

`SceneCells` draws a small vector or matrix: `values` (a flat list is one row; a list of lists is a matrix) or `cells`
(`{ id?, text?, value?, label? }` rows), `direction`, `format`, `palette` (`'sequential'` or `'diverging'`) with
`domain`, `rowLabels`, `columnLabels` (they wrap, and a long word overhangs rather than being cut), `highlight`
(`{ row?, column? }`) and `size`. A cell also takes `tone`, such as its suit's hue, and `isMuted` to gray one already
dealt. A cell's id is `${id}.${row}.${column}`, so a wire or callout can name one. Changed values ease. For a large grid
with axes, use the `Matrix` chart.

```tsx
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

## Tokens

- `SceneToken`: one token in monospace, with `text` (spaces show as faint marks), `tokenId`, `probability` (a bar and a
  percent that ease) and `format`. Move it with `at`.
- `SceneTokens`: a sequence, `tokens` of `{ text, tokenId?, probability?, tone?, label? }`, wrapping at `wrapWidth`
  pixels. Token `n` has the id `${id}.${n}`.

```tsx
const reveal = defineLesson({
  id: 'reveal',
  title: 'Tokens and counts',
  params: {
    isPredicted: { kind: 'toggle', label: 'Show the prediction', value: false },
    isCounted: { kind: 'toggle', label: 'Count by suit', value: false },
  },
  derived: {
    score: { label: 'Score', format: { maximumFractionDigits: 1 }, from: ({ isPredicted }) => (isPredicted ? 1 : 0) },
  },
});

/** A prompt as tokens, and the predicted next token travelling to the end of it. */
export function PromptScene(): ReactNode {
  const { values, locale } = useLesson(reveal);

  return (
    <Scene
      title="The next token"
      description="Synthetic prompt and probability. The model's guess joins the prompt once it is chosen."
      locale={locale}
      x={[0, 4]}
      y={[0, 2]}
    >
      <SceneTokens
        id="prompt"
        at={[1.6, 1.4]}
        tokens={[{ text: 'The' }, { text: ' cat' }, { text: ' sat' }]}
        label="The prompt, three tokens"
      />
      <SceneToken
        id="guess"
        at={values.isPredicted ? [3.2, 1.4] : [2, 0.4]}
        text=" on"
        probability={0.42}
        label="The predicted token, on, 42%"
      />
    </Scene>
  );
}
```

## The derivation

`LessonFlow` is a figure of its own that draws the lesson's derived values as a graph: each param and derived value is a
node wired to what it reads, params are inline controls, and a change glows through what it touched. It takes `names`
(draw these and what they read), `formula` (plain text per derived value), `layout` (`'across'` or `'down'`) and the
scene's figure props; `title` defaults to the lesson's. `SceneFlow` is the same inside a hand-placed `Scene`, in the
part of the box given by `at`:

```tsx
/** The lesson's derivation beside a hand-placed node, inside one scene. */
export function ForwardScene(): ReactNode {
  return (
    <Scene title="The forward pass" description="Each value, wired to what it reads." x={[0, 6]} y={[0, 3]}>
      <SceneNode id="stage" at={[0, 1.5]} text="Forward" label="The forward pass" />
      <SceneFlow at={{ x: [1, 6], y: [0, 3] }} names={['score']} formula={{ score: 'one when the prediction shows' }} />
    </Scene>
  );
}
```

## Morph

`MorphScope` shows one of several figures that draw the same things. When `show` changes, everything drawn in both,
matched by id, travels from its place in one figure to its place in the other while the figures cross-fade. It takes
`figures` (by name), `show`, `pace` (defaults to `'slow'`) and `tones`. Use it once or twice per essay, for the moment
an object becomes data: a card becomes a bar, a neuron a dot.

The ids must match. A scene node's id is its `id`. A chart mark's id is its record's id: in a `BarChart` with one series
it is the category id, and with several it is `category:series`.

```tsx
/** The two hearts and two spades as nodes; each id is the bar segment it becomes. */
function Hand(): ReactNode {
  return (
    <Scene title="The four cards" description="Synthetic cards, as dealt." locale="en-US" x={[0, 3]} y={[0, 1]}>
      <SceneNode id="hearts:queen" at={[0, 0.5]} text="Q♥" label="Queen of Hearts" size="small" />
      <SceneNode id="hearts:two" at={[1, 0.5]} text="2♥" label="Two of Hearts" size="small" />
      <SceneNode id="spades:seven" at={[2, 0.5]} text="7♠" label="Seven of Spades" size="small" />
      <SceneNode id="spades:king" at={[3, 0.5]} text="K♠" label="King of Spades" size="small" />
    </Scene>
  );
}

const cardsBySuit = [
  { id: 'queen', label: 'Q♥', values: [1, 0] },
  { id: 'two', label: '2♥', values: [1, 0] },
  { id: 'seven', label: '7♠', values: [0, 1] },
  { id: 'king', label: 'K♠', values: [0, 1] },
] as const;

/** The same cards counted by suit: one series per card, so each segment's id is `suit:card`. */
function Counts(): ReactNode {
  return (
    <BarChart
      title="Cards per suit"
      description="The same synthetic cards, stacked by suit."
      locale="en-US"
      categories={[
        { id: 'hearts', label: 'Hearts' },
        { id: 'spades', label: 'Spades' },
      ]}
      series={cardsBySuit.map((card) => ({ id: card.id, label: card.label, values: card.values }))}
      mode="stacked"
      domain={[0, 2]}
      valueFormat={{ maximumFractionDigits: 0 }}
      valueLabel="Cards"
    />
  );
}

/** A toggle param of the lesson decides which figure shows; every card travels to its bar segment. */
export function CountMorph(): ReactNode {
  const { values } = useLesson(reveal);

  return <MorphScope figures={{ hand: <Hand />, counts: <Counts /> }} show={values.isCounted ? 'counts' : 'hand'} />;
}
```

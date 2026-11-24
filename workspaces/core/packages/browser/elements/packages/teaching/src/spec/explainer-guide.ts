/** Every teaching part an author or an agent chooses between when writing an explainer, in reading order. */
export const explainerParts = [
  'Lesson',
  'Param',
  'Value',
  'ParamSlider',
  'ParamChoice',
  'ParamToggle',
  'Playback',
  'Transport',
  'Scene',
  'SceneNode',
  'SceneWire',
  'SceneGroup',
  'SceneBracket',
  'SceneCallout',
  'SceneHighlight',
  'SceneCustom',
  'SceneAxes',
  'SceneCurve',
  'ScenePoint',
  'SceneVector',
  'SceneProjection',
  'SceneRegion',
  'SceneRule',
  'SceneCard',
  'SceneStack',
  'SceneSlot',
  'SceneCells',
  'SceneToken',
  'SceneTokens',
  'SceneFlow',
  'LessonFlow',
  'MorphScope',
  'Article',
  'Beat',
  'Figure',
  'FigureReference',
  'Reveal',
  'Scrolly',
  'Predict',
  'Challenge',
  'Aside',
  'Footnote',
  'Cite',
  'References',
  'TeX',
  'Term',
  'DiagramPart',
] as const;

/** The name of a teaching part. */
export type ExplainerPart = (typeof explainerParts)[number];

/** One teaching part in the guide: the reader question it answers, when to use it, and a few lines of TSX. */
export type ExplainerGuideEntry = {
  readonly part: ExplainerPart;
  /** The public entry to import it from. */
  readonly entry: string;
  /** The question a reader has that this part answers, in the reader's words. */
  readonly question: string;
  /** When to use it, and when another part is better, naming it. */
  readonly guidance: string;
  /** A few lines of TSX that use it well. */
  readonly example: string;
};

const LESSON = '@mechane-ai/elements/lesson';
const SCENE = '@mechane-ai/elements/scene';
const ARTICLE = '@mechane-ai/elements/article';

type GuideText = Omit<ExplainerGuideEntry, 'part'>;

const book: Readonly<Record<ExplainerPart, GuideText>> = {
  Lesson: {
    entry: LESSON,
    question: 'Which values does this explainer let me change, and do the words and pictures agree on them?',
    guidance:
      'Wrap every explainer in one Lesson, declared once with defineLesson; an Article renders it for you. Set shouldSyncUrl to keep the values in the address bar. Use a second Lesson only for an independent copy.',
    example: `const lesson = defineLesson({
  id: 'softmax',
  title: 'How temperature reshapes a softmax',
  params: { temperature: { kind: 'number', label: 'Temperature', value: 1, min: 0.1, max: 10, step: 0.01, scale: 'log', format: { maximumFractionDigits: 2 } } },
  derived: { entropy: { label: 'Entropy', format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 }, from: ({ temperature }) => entropyOf(temperature) } },
  beats: [{ id: 'scores', title: 'Scores become probabilities', goal: 'Dividing by a temperature flattens or sharpens the distribution.' }],
});

<Lesson lesson={lesson} locale="en-US" shouldSyncUrl>…</Lesson>`,
  },
  Param: {
    entry: LESSON,
    question: 'What happens if I change this number in the sentence?',
    guidance:
      'Use it inside prose, where the reader meets a value: a number drags, a choice opens a picker, a toggle switches. Use ParamSlider for a labelled control under a figure.',
    example: `<p>
  Divide every score by a temperature of <Param name="temperature" /> before the softmax.
</p>`,
  },
  Value: {
    entry: LESSON,
    question: 'What is the result right now?',
    guidance:
      'Use it to write a param or a derived value in prose, in its declared format, so the sentence follows every change. Use Param instead when the reader should change the value there.',
    example: `<p>
  The followed token now gets <Value name="probability" /> of the probability.
</p>`,
  },
  ParamSlider: {
    entry: LESSON,
    question: 'How does the figure change as I sweep this value?',
    guidance:
      'Use it under a figure for a number param the reader sweeps through its range. Inside a sentence, use Param; for a time-like param the lesson plays, use Transport.',
    example: `<Figure id="bars" caption="Probabilities after the softmax." description="Four bars, one per token, that sum to one." reads={['temperature']}>
  <TokenBars />
  <ParamSlider name="temperature" />
</Figure>`,
  },
  ParamChoice: {
    entry: LESSON,
    question: 'What if it were this option instead of that one?',
    guidance:
      'Use it for a choice param with two to five options shown side by side. In a sentence use Param, which opens an inline picker.',
    example: `<ParamChoice name="token" />`,
  },
  ParamToggle: {
    entry: LESSON,
    question: 'What changes when I turn this on?',
    guidance:
      'Use it for a yes or no param under a figure, such as showing an answer or masking tokens. In a sentence use Param.',
    example: `<ParamToggle name="isTopTwo" />`,
  },
  Playback: {
    entry: LESSON,
    question: 'How does this unfold over time?',
    guidance:
      'Use it to drive a number param step by step, such as training steps or tokens generated. It renders nothing: pair it with a Transport so the reader can pause and scrub.',
    example: `<Playback name="trainStep" pace="regular" />
<Transport for="trainStep" />`,
  },
  Transport: {
    entry: LESSON,
    question: 'Can I pause it, step through it, or go back?',
    guidance:
      'Use it beside every Playback. It plays, pauses, steps and scrubs the same param. Use ParamSlider when the value has no natural order in time.',
    example: `<Transport for="trainStep" />`,
  },
  Scene: {
    entry: SCENE,
    question: 'How are these parts connected, and what moves when a value changes?',
    guidance:
      'Use it for a diagram whose objects keep their identity across states: give each object an id and change its props. Use a chart when the picture is data on axes.',
    example: `<Scene title="A weighted sum" description="Two inputs feed one output." x={[0, 4]} y={[0, 2]}>
  <SceneNode id="a" at={[0.5, 1.5]} label="Input a" text="a" />
  <SceneNode id="b" at={[0.5, 0.5]} label="Input b" text="b" />
  <SceneNode id="sum" at={[3.5, 1]} label="Weighted sum" text="Σ" />
  <SceneWire from="a" to="sum" weight={0.8} hasArrow />
  <SceneWire from="b" to="sum" weight={0.2} hasArrow />
</Scene>`,
  },
  SceneNode: {
    entry: SCENE,
    question: 'What is this thing, and where did it go?',
    guidance:
      'Use it for each named thing in a scene: a token, a neuron, a card. Change at, size, tone, turn or lift and it eases there; isShown fades it.',
    example: `<SceneNode id="queen" at={[1, 1.5]} label="Queen of Hearts, weight 0.8" text="Q♥" size="medium" turn={isRevealed ? 0 : 1} />`,
  },
  SceneWire: {
    entry: SCENE,
    question: 'What feeds into what, and how strongly?',
    guidance:
      'Use it between two nodes; weight sets its thickness and it stays attached while they move. Its text sits beside the stroke, above a level wire and right of an upright one; set textSide when that side collides. Use SceneFlow for a whole derivation graph.',
    example: `<SceneWire from="queen" to="sum" label="Weight 0.8" weight={0.8} text="0.8" textSide="bottom" hasArrow />`,
  },
  SceneGroup: {
    entry: SCENE,
    question: 'Which of these belong together?',
    guidance:
      'Use it to box several nodes as one named part, such as a layer. Use SceneBracket when the grouping is a span along one side.',
    example: `<SceneGroup id="hidden" label="Hidden layer" around={['h1', 'h2', 'h3']} />`,
  },
  SceneBracket: {
    entry: SCENE,
    question: 'What does this run of things add up to?',
    guidance:
      'Use it to mark a span of nodes along one side with a short name, such as a context window. Use SceneGroup to enclose them.',
    example: `<SceneBracket of={['t1', 't2', 't3']} side="bottom" label="The context window, three tokens" text="context" />`,
  },
  SceneCallout: {
    entry: SCENE,
    question: 'Why does this part matter?',
    guidance:
      'Use it for one short note pointing at one object. Keep it to a sentence; longer explanation belongs in the prose beside the figure.',
    example: `<SceneCallout to="sum" side="right">The weighted sum</SceneCallout>`,
  },
  SceneHighlight: {
    entry: SCENE,
    question: 'Where should I look now?',
    guidance:
      'Use it to draw the eye to one or a few objects for the current beat. Use the scene focus to zoom instead when the rest is noise.',
    example: `<SceneHighlight of={['queen', 'sum']} />`,
  },
  SceneCustom: {
    entry: SCENE,
    question: 'What does this shape look like, when no scene part draws it?',
    guidance:
      'Use it for a drawing the scene parts lack, with the scene scales and tones it hands you. Prefer a named part when one exists, so the drawing stays inspectable.',
    example: `<SceneCustom>
  {({ x, y, color, tone }) => (
    <circle cx={x.position(2)} cy={y.position(1)} r={6} fill={color(tone({ id: 'sum', index: 0 }))} />
  )}
</SceneCustom>`,
  },
  SceneAxes: {
    entry: SCENE,
    question: 'What do the positions in this picture measure?',
    guidance:
      'Use it in a Scene whose box is a coordinate plane, for ticks, axis titles with units, and a grid that follow the camera. Leave it out of a diagram whose positions mean nothing.',
    example: `<SceneAxes x={{ label: 'Input z' }} y={{ label: 'Output σ(z)', ticks: [0, 0.5, 1] }} grid="both" />`,
  },
  SceneCurve: {
    entry: SCENE,
    question: 'What is the shape of this function?',
    guidance:
      'Use it in a Scene to draw a function, with of, or a path of points, in data units; it eases to a new shape. Use CurveChart for measured data with a legend and readout.',
    example: `<Scene title="The sigmoid" description="σ(z) rises from 0 to 1." x={[-6, 6]} y={[0, 1]}>
  <SceneAxes x={{ label: 'Input z' }} y={{ label: 'Output σ(z)' }} />
  <SceneCurve id="sigmoid" of={sigmoid} resolution="fine" label="The sigmoid, rising from 0 to 1" />
</Scene>`,
  },
  ScenePoint: {
    entry: SCENE,
    question: 'Where is this one value on the plane, and what if I move it?',
    guidance:
      'Use it for a single marked point. With sets, the reader drags it or moves it with the arrow keys and it writes lesson params on their step grid; at reads them back, and along keeps it on a curve. Use ScatterPlot for many records.',
    example: `<ScenePoint id="probe" at={[values.temperature, values.entropy]} along={entropyOf} sets={{ x: 'temperature' }} label={\`Temperature \${values.temperature.toFixed(2)}\`} />`,
  },
  SceneVector: {
    entry: SCENE,
    question: 'Which way does this push, and how far?',
    guidance:
      'Use it for an arrow with a direction and a length, such as a gradient step; both ends ease. Use SceneWire to connect two objects.',
    example: `<SceneVector id="gradient" from={[1, 1]} to={[0.6, 0.7]} text="step" label="Gradient step" />`,
  },
  SceneProjection: {
    entry: SCENE,
    question: 'What are this point’s values on each axis?',
    guidance:
      'Use it with SceneAxes to drop dashed lines from a ScenePoint, named by of, to both axes and write its values there. Use SceneRule for a fixed threshold.',
    example: `<SceneProjection id="drop" of="probe" format={{ maximumFractionDigits: 2 }} />`,
  },
  SceneRegion: {
    entry: SCENE,
    question: 'Which part of the plane is this?',
    guidance:
      'Use it to shade a zone: above or below a value, between two values, or a polygon of points. Keep it pale: a region is context, not data.',
    example: `<SceneRegion id="positive" above={0.5} tone="positive" text="Positive" label="Classified as positive" />`,
  },
  SceneRule: {
    entry: SCENE,
    question: 'Where is the threshold?',
    guidance:
      'Use it for one horizontal or vertical line at a value, such as a target or an asymptote, with a short text. Use SceneCurve for any other line.',
    example: `<SceneRule id="threshold" y={0.5} text="Threshold" label="Threshold at 0.5" />`,
  },
  SceneCard: {
    entry: SCENE,
    question: 'What is on the other side of this, and which comes first?',
    guidance:
      'Use it for an object that turns over, lifts or deals out, like a playing card or a hidden answer. Use SceneNode for a flat label, and SceneStack to lay several out.',
    example: `<SceneCard id="queen" at={[1, 1]} rank="Q" suit="heart" isFaceUp={isRevealed} label="Queen of Hearts" />`,
  },
  SceneStack: {
    entry: SCENE,
    question: 'How are these cards laid out together?',
    guidance:
      'Use it to place SceneCards, by id, as a pile, a fan, a row or a column; change the list and the cards move. Give it a stagger to deal: cards it takes in one step set off one after another, and a card that moves alone sets off at once. Place a lone card with its own at.',
    example: `<SceneStack id="hand" at={[2, 1]} cards={['queen', 'seven']} layout="fan" stagger="regular" label="Your hand" />`,
  },
  SceneSlot: {
    entry: SCENE,
    question: 'Where does this go?',
    guidance:
      'Use it for an empty place a card or token is dealt to, such as a table or an answer box; isActive marks the one that is next. Use SceneGroup to enclose objects already there.',
    example: `<SceneSlot id="table" at={[3, 1]} text="Table" label="The table, where a played card lands" isActive />`,
  },
  SceneCells: {
    entry: SCENE,
    question: 'What is inside this vector or matrix, cell by cell?',
    guidance:
      'Use it for a small grid of values that moves and changes inside a scene: a flat list is one row, a list of lists is a matrix. Use Matrix for a large grid with axes and a scale legend.',
    example: `<SceneCells id="weights" at={[2, 1]} values={[[0.2, -0.4, 0.1], [0.7, 0.3, -0.2]]} rowLabels={['h1', 'h2']} format={{ maximumFractionDigits: 1 }} label="Weight matrix" />`,
  },
  SceneToken: {
    entry: SCENE,
    question: 'Which piece of text is this, and where does it go?',
    guidance:
      'Use it for one token that moves through a diagram with its text in monospace and, optionally, its probability. Use SceneTokens for a run of them, and TokenGrid for a long run as data.',
    example: `<SceneToken id="t3" at={[1, 1]} text=" sat" probability={0.42} label="Token 3, sat" />`,
  },
  SceneTokens: {
    entry: SCENE,
    question: 'How is this text split into tokens?',
    guidance:
      'Use it for a prompt or a short output laid out as tokens that wrap at wrapWidth. Use SceneToken for a single token that moves on its own.',
    example: `<SceneTokens id="prompt" at={[0, 1]} tokens={[{ text: 'The' }, { text: ' cat' }, { text: ' sat', probability: 0.42 }]} label="The prompt, three tokens" />`,
  },
  SceneFlow: {
    entry: SCENE,
    question: 'How is this result computed from the values I can change?',
    guidance:
      'Use it inside a Scene to draw the lesson derivation graph, from lessonGraph, with live values, in the part of the box at names. Use LessonFlow when the flow is the whole figure.',
    example: `<Scene title="The forward pass" description="Each value, wired to what it reads." x={[0, 6]} y={[0, 3]}>
  <SceneNode id="stage" at={[0, 1.5]} text="Forward" />
  <SceneFlow at={{ x: [1, 6], y: [0, 3] }} names={['entropy']} formula={{ entropy: '−Σ p log₂ p' }} />
</Scene>`,
  },
  LessonFlow: {
    entry: SCENE,
    question: 'Which values does this result depend on?',
    guidance:
      'Use it as a figure of its own that draws the lesson derivation graph, sized to fit, with params as inline controls. Draw a hand-placed Scene when the layout carries meaning.',
    example: `<LessonFlow title="How entropy is computed" description="Each value, wired to the values it reads." names={['entropy']} formula={{ entropy: '−Σ p log₂ p' }} />`,
  },
  MorphScope: {
    entry: SCENE,
    question: 'Is this the same thing I saw in the diagram, now shown as data?',
    guidance:
      'Use it when an object in a scene becomes a mark in a chart, so the reader follows its identity: name each figure and show one. Use it sparingly, for one key transition.',
    example: `<MorphScope figures={{ cards: <CardScene />, counts: <CountChart /> }} show={isCounted ? 'counts' : 'cards'} />`,
  },
  Article: {
    entry: ARTICLE,
    question: 'What is this essay about, and where am I in it?',
    guidance:
      'Use it once around a whole explainer: it renders the lesson, the contents and the article, present, static and sheet views from the same children.',
    example: `<Article lesson={lesson} locale="en-US" title="How temperature reshapes a softmax" summary="A synthetic four-token example.">
  <Beat id="scores">…</Beat>
  <Beat id="training">…</Beat>
</Article>`,
  },
  Beat: {
    entry: ARTICLE,
    question: 'What is this section trying to show me?',
    guidance:
      'Use one per lesson beat: its title, tutor notes, steps and states come from the definition. Keep each beat to one idea and one new param.',
    example: `<Beat id="scores">
  <p>Divide every score by <Param name="temperature" />.</p>
  <Figure id="bars" caption="Probabilities after the softmax." description="Four bars that sum to one." reads={['temperature']}>
    <TokenBars />
  </Figure>
</Beat>`,
  },
  Figure: {
    entry: ARTICLE,
    question: 'What am I looking at here?',
    guidance:
      'Wrap every scene or chart in a beat with a Figure: a caption, a description for the static view, and the values it reads. Size text keeps it to the prose column.',
    example: `<Figure id="bet-split" caption="Your bet, split across the two cards." description="Two cards with the share of the bet on each." reads={['bet']} size="text">
  <BetScene />
</Figure>`,
  },
  FigureReference: {
    entry: ARTICLE,
    question: 'Which figure is this sentence talking about?',
    guidance:
      'Use it in prose to point at a Figure by id; it writes the figure number and links to it in every view. Do not write figure numbers by hand.',
    example: `<p>As <FigureReference to="bars" /> shows, a cold softmax piles the probability on one token.</p>`,
  },
  Reveal: {
    entry: ARTICLE,
    question: 'What comes next, once I am ready?',
    guidance:
      'Use it to show content from a reveal step of the beat on. Declare the step count in the beat definition; do not hide content the static view needs.',
    example: `<Reveal at={1}>
  <p>Training sharpens the scores, so the same temperature now gives <Value name="probability" />.</p>
</Reveal>`,
  },
  Scrolly: {
    entry: ARTICLE,
    question: 'How does the picture change as I read on?',
    guidance:
      'Use it for one sticky figure that moves through states as steps of prose scroll past; each step sets values or a beat state. Use Reveal and Transport when the reader should drive the pace.',
    example: `<Scrolly figure={<Figure id="deal" caption="The deal." description="Cards dealt one by one." reads={['dealt']}><BetScene /></Figure>}>
  <ScrollyStep id="first" values={{ dealt: 1 }}>The first card is dealt.</ScrollyStep>
  <ScrollyStep id="second" state="both-dealt">Then the second.</ScrollyStep>
</Scrolly>`,
  },
  Predict: {
    entry: ARTICLE,
    question: 'What do I expect to happen before I see it?',
    guidance:
      'Use it before a result the reader could guess wrong: options with an answer id, or a number with its range, format and an answer or answerFrom. The answer stays hidden, from readers and agents, until the reader commits.',
    example: `<Predict id="entropy-guess" prompt="At this temperature, how many bits of entropy are left?" min={0} max={2} step={0.05} format={{ style: 'unit', unit: 'bit', maximumFractionDigits: 2 }} answerFrom="entropy" tolerance={0.15}>
  <p>A cold softmax piles most of the probability on the top token, so little uncertainty is left.</p>
</Predict>`,
  },
  Challenge: {
    entry: ARTICLE,
    question: 'Can I make it do this myself?',
    guidance:
      'Use it to set a goal the reader reaches by moving params, checked from the values by name, with hints in order. Only the reader reaching it counts; an agent never completes it.',
    example: `<Challenge id="low-entropy" prompt="Find a temperature that leaves under 0.5 bits of entropy." isReached={(values) => Number(values['entropy']) < 0.5} hints={['Lower the temperature.']}>
  <p>Lower temperatures concentrate the distribution.</p>
</Challenge>`,
  },
  Aside: {
    entry: ARTICLE,
    question: 'Is there more to this, if I want it?',
    guidance: 'Use it for a digression a curious reader may skip. Use Footnote for a short source or caveat.',
    example: `<Aside>Temperature 1 leaves the scores as the model gave them.</Aside>`,
  },
  Footnote: {
    entry: ARTICLE,
    question: 'Where does this claim come from, or what is the caveat?',
    guidance:
      'Use it for a one-sentence caveat or source attached to a sentence, with an id unique in the article. Use Cite for a reference in the bibliography.',
    example: `<p>The scores are synthetic.<Footnote id="synthetic">They were chosen by hand to make the example clear.</Footnote></p>`,
  },
  Cite: {
    entry: ARTICLE,
    question: 'Who showed this first?',
    guidance:
      'Use it to cite an entry of the References list by id. Keep the reference data in one References block at the end.',
    example: `<p>Explorable explanations<Cite id="victor2011" /> let the reader change the example.</p>`,
  },
  References: {
    entry: ARTICLE,
    question: 'Where can I read more?',
    guidance:
      'Use it once, after the last beat, with every entry a Cite names. Keep the data in one list so the static and sheet views number them the same.',
    example: `<References items={[{ id: 'victor2011', authors: ['Bret Victor'], title: 'Explorable Explanations', year: 2011, url: 'https://worrydream.com/ExplorableExplanations/' }]} />`,
  },
  TeX: {
    entry: ARTICLE,
    question: 'What is the exact formula?',
    guidance:
      'Use it for TeX the application typesets through the Article math prop; without one it shows the source. Use Value for a number that changes.',
    example: `<p>Surprise is <TeX>{String.raw\`-\\log_2 p\`}</TeX> bits.</p>
<TeX isDisplay>{String.raw\`H = -\\sum_i p_i \\log_2 p_i\`}</TeX>`,
  },
  Term: {
    entry: ARTICLE,
    question: 'Which part of the figure does this word mean?',
    guidance:
      'Use it for a word in prose that names an object in a figure: hovering or focusing it inspects that object. Use plain text for words with no figure object.',
    example: `<p>The <Term inspects="queen">Queen</Term> carries most of the bet.</p>`,
  },
  DiagramPart: {
    entry: ARTICLE,
    question: 'Which record of the chart is this part of the drawing?',
    guidance:
      'Use it around the shapes of a hand-drawn SVG diagram that stand for one record, so pointing at either highlights both. Use a Scene when the diagram should move between states.',
    example: `<svg viewBox="0 0 120 60" role="img" aria-label="Two cards">
  <DiagramPart inspects="queen" label="Queen of Hearts">
    <rect x={10} y={10} width={30} height={40} />
  </DiagramPart>
</svg>`,
  },
};

/**
 * The teaching parts, each with the reader question it answers, when to use it, and a short TSX example. Read it to
 * choose parts when planning a lesson; a plan's figure names one of these parts or a chart from `chartGuide`.
 */
export const explainerGuide: ReadonlyArray<ExplainerGuideEntry> = explainerParts.map((part) => ({
  part,
  ...book[part],
}));

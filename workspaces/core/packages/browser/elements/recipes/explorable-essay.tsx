import { Article, Beat, Figure, Predict } from '@mechane-ai/elements/article';
import { CurveChart } from '@mechane-ai/elements/charts/trend';
import { defineLesson, Param, useLesson, Value } from '@mechane-ai/elements/lesson';
import { Scene, SceneNode, SceneWire } from '@mechane-ai/elements/scene';
import { spacing } from '@mechane-ai/elements/tokens';

type EssayProps = { readonly title: string; readonly summary: string };

const BATCH_MAX = 256;
const CURVE_POINTS = 33;
const PAGE_WIDTH = 1200;

/** The page's own gutter: an article fills what it is given and leaves the edges to the page. */
const pageStyle = {
  boxSizing: 'border-box',
  maxWidth: PAGE_WIDTH,
  margin: '0 auto',
  padding: `${spacing.xxl} ${spacing.lg}`,
} as const;

/** Gradient noise falls with the square root of the batch size. The numbers are synthetic. */
const lesson = defineLesson({
  id: 'batch-noise',
  title: 'Why a bigger batch is quieter',
  params: {
    batch: {
      kind: 'number',
      label: 'Batch size',
      value: 4,
      min: 1,
      max: BATCH_MAX,
      step: 1,
      scale: 'log',
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    noise: {
      label: 'Gradient noise',
      format: { style: 'percent', maximumFractionDigits: 0 },
      from: ({ batch }) => 1 / Math.sqrt(batch),
    },
  },
  beats: [
    {
      id: 'estimate',
      title: 'A batch estimates the gradient',
      goal: 'See that the gradient of a batch is an average, so its error comes from how few examples it averages.',
      states: [
        { id: 'single', label: 'One example', values: { batch: 1 } },
        { id: 'sixteen', label: 'Sixteen examples', values: { batch: 16 } },
      ],
    },
    {
      id: 'noise',
      title: 'Noise falls with the square root',
      goal: 'Find that four times the examples halves the noise, not quarters it.',
      misconception: 'That doubling the batch halves the noise.',
      states: [
        { id: 'four', label: 'Four examples', values: { batch: 4 } },
        { id: 'sixty-four', label: 'Sixty-four examples', values: { batch: 64 } },
      ],
    },
  ],
});

const batches = Array.from({ length: CURVE_POINTS }, (_, index) => BATCH_MAX ** (index / (CURVE_POINTS - 1)));

function BatchScene() {
  const { values, locale } = useLesson(lesson);

  return (
    <Scene
      title="From a batch to a gradient"
      description="Synthetic. A batch of examples is averaged into one gradient estimate whose noise shrinks as the batch grows."
      locale={locale}
      x={[0, 2]}
      y={[0, 1]}
      height="compact"
    >
      <SceneNode
        id="batch"
        at={[0.5, 0.5]}
        text={`${values.batch} examples`}
        label={`A batch of ${values.batch} examples`}
      />
      <SceneNode
        id="gradient"
        at={[1.5, 0.5]}
        shape="pill"
        text="gradient"
        label={`The averaged gradient, with noise ${Math.round(values.noise * 100)}% of a single example's`}
        tone={values.noise > 0.5 ? 'negative' : 'positive'}
      />
      <SceneWire from="batch" to="gradient" label="The examples are averaged" />
    </Scene>
  );
}

function NoiseCurve() {
  const { values, locale } = useLesson(lesson);

  return (
    <CurveChart
      title="Gradient noise by batch size"
      description="Synthetic noise as a share of a single example's noise, on a log batch axis."
      locale={locale}
      series={[
        {
          id: 'noise',
          label: 'Noise',
          tone: 'series1',
          points: batches.map((batch) => ({ x: batch, y: 1 / Math.sqrt(batch) })),
        },
      ]}
      x={{ label: 'Batch size', scale: 'log', domain: [1, BATCH_MAX], format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Noise', domain: [0, 1], format: { style: 'percent', maximumFractionDigits: 0 } }}
      markers={[{ x: values.batch, label: 'Now' }]}
      labels="none"
      height="compact"
    />
  );
}

/**
 * Build an explorable essay in one TSX file: a lesson that declares the values, two beats of prose that read them, a
 * scene, a chart and a prediction. Pass a title and a summary. Use an MDX file with the essay starter instead when the
 * prose is long.
 */
export function ExplorableEssay({ title, summary }: EssayProps) {
  return (
    <main style={pageStyle}>
      <Article lesson={lesson} locale="en-US" title={title} summary={summary}>
        <Beat id="estimate">
          <p>
            A gradient from <Param name="batch" /> examples is their average, so it is noisy by <Value name="noise" />{' '}
            of what a single example gives.
          </p>
          <Figure
            id="batch-scene"
            caption="A batch of examples is averaged into one gradient."
            description="Two boxes joined by an arrow: the batch of examples and the gradient they average into."
          >
            <BatchScene />
          </Figure>
        </Beat>
        <Beat id="noise">
          <Predict
            id="quadruple"
            prompt="Four times the examples: how does the noise change?"
            options={[
              { id: 'quarter', label: 'It falls to a quarter' },
              { id: 'half', label: 'It halves' },
              { id: 'same', label: 'It stays the same' },
            ]}
            answer="half"
          >
            <p>Noise falls with the square root of the batch size, so four times the examples halves it.</p>
          </Predict>
          <Figure
            id="noise-curve"
            caption="Noise at every batch size, with the current one marked."
            description="A curve falling steeply for small batches and slowly for large ones."
            reads={['batch']}
          >
            <NoiseCurve />
          </Figure>
        </Beat>
      </Article>
    </main>
  );
}

import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { BarChart } from '../../packages/charts/src/cartesian/bar-chart.tsx';
import { formatValue } from '../../packages/charts/src/figure/figure-format.ts';
import { CurveChart } from '../../packages/charts/src/trend/curve-chart.tsx';
import { spacing } from '../../packages/foundations/src/tokens.stylex.ts';
import type { ArticleMath } from '../../packages/teaching/src/article/article-context.ts';
import { Beat } from '../../packages/teaching/src/article/beat.tsx';
import { Challenge } from '../../packages/teaching/src/article/challenge.tsx';
import { Figure, FigureReference, Reveal } from '../../packages/teaching/src/article/figure.tsx';
import { Aside, Cite, Footnote, References } from '../../packages/teaching/src/article/notes.tsx';
import type { ReferenceItem } from '../../packages/teaching/src/article/outline-types.ts';
import { Predict } from '../../packages/teaching/src/article/predict.tsx';
import { Scrolly, ScrollyStep } from '../../packages/teaching/src/article/scrolly.tsx';
import { Term } from '../../packages/teaching/src/article/term.tsx';
import { TeX } from '../../packages/teaching/src/article/tex.tsx';
import { defineLesson } from '../../packages/teaching/src/lesson/define-lesson.ts';
import type { LessonValue } from '../../packages/teaching/src/lesson/define-lesson.ts';
import { Param, Value } from '../../packages/teaching/src/lesson/param.tsx';
import { Playback } from '../../packages/teaching/src/lesson/playback.tsx';
import { Transport } from '../../packages/teaching/src/lesson/transport.tsx';
import { useLesson } from '../../packages/teaching/src/lesson/use-lesson.ts';

/** Synthetic next-token scores for "The capital of France is ___". */
const candidates = [
  { id: 'paris', label: 'Paris', score: 3.1 },
  { id: 'lyon', label: 'Lyon', score: 1.4 },
  { id: 'rome', label: 'Rome', score: 0.9 },
  { id: 'cheese', label: 'cheese', score: -0.6 },
] as const;

const TRAIN_STEPS = 40;
const SHARPEN = 1.2;
const CURVE_POINTS = 41;
const T_MIN = 0.1;
const T_MAX = 10;
const CONFIDENT = 0.9;
const TRAINED = 30;

function sum(values: ReadonlyArray<number>): number {
  const total = { value: 0 };

  for (const value of values) {
    total.value += value;
  }

  return total.value;
}

/** The softmax of the synthetic scores, sharpened by training and divided by the temperature. */
function isTrained(values: Readonly<Record<string, LessonValue>>): boolean {
  return Number(values['trainStep']) >= TRAINED;
}

function shares(temperature: number, trainStep: number): ReadonlyArray<number> {
  const gain = 1 + (SHARPEN * trainStep) / TRAIN_STEPS;
  const weights = candidates.map((candidate) => Math.exp((candidate.score * gain) / temperature));
  const total = sum(weights);

  return weights.map((weight) => weight / total);
}

function bits(probabilities: ReadonlyArray<number>): number {
  return -sum(probabilities.map((share) => (share > 0 ? share * Math.log2(share) : 0)));
}

export const temperatureLesson = defineLesson({
  id: 'temperature',
  title: 'What a softmax temperature does',
  params: {
    temperature: {
      kind: 'number',
      label: 'Temperature',
      value: 1,
      min: T_MIN,
      max: T_MAX,
      step: 0.01,
      scale: 'log',
      format: { maximumFractionDigits: 2 },
    },
    trainStep: {
      kind: 'number',
      label: 'Training step',
      value: 0,
      min: 0,
      max: TRAIN_STEPS,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    top: {
      label: 'Probability of “Paris”',
      format: { style: 'percent', maximumFractionDigits: 1 },
      from: (values) => shares(values.temperature, values.trainStep)[0] ?? 0,
    },
    entropy: {
      label: 'Entropy',
      format: { style: 'unit', unit: 'bit', maximumFractionDigits: 2 },
      from: (values) => bits(shares(values.temperature, values.trainStep)),
    },
  },
  beats: [
    {
      id: 'scores',
      title: 'Scores become probabilities',
      goal: 'See that the softmax keeps the order of the scores and only changes their spread.',
      misconception: 'That the softmax picks the top token; it only weights it.',
      states: [
        { id: 'neutral', label: 'T = 1', values: { temperature: 1 } },
        { id: 'chilled', label: 'T = 0.5', values: { temperature: 0.5 } },
      ],
    },
    {
      id: 'temperature',
      title: 'Temperature trades confidence for spread',
      goal: 'Connect a low temperature with a peaked distribution and a high one with a flat one.',
      hints: ['Drag the temperature below 0.5 and watch Paris.', 'Compare the curves at T = 4.'],
      states: [
        { id: 'cold', label: 'Cold, T = 0.25', values: { temperature: 0.25 } },
        { id: 'warm', label: 'Warm, T = 1', values: { temperature: 1 } },
        { id: 'hot', label: 'Hot, T = 4', values: { temperature: 4 } },
      ],
    },
    {
      id: 'entropy',
      title: 'Entropy measures the spread',
      steps: 1,
      misconception: 'That entropy keeps rising with temperature; it levels off at two bits.',
      states: [{ id: 'entropy-warm', label: 'T = 1', values: { temperature: 1 } }],
    },
    {
      id: 'confidence',
      title: 'Make the model sure',
      goal: 'Find a temperature that makes Paris at least 90% likely.',
    },
    {
      id: 'training',
      title: 'Training sharpens the scores',
      steps: 1,
      states: [
        { id: 'untrained', label: 'Step 0', values: { trainStep: 0, temperature: 1 } },
        { id: 'trained', label: 'Step 40', values: { trainStep: TRAIN_STEPS, temperature: 1 } },
      ],
    },
  ],
});

const percent = { style: 'percent', maximumFractionDigits: 0 } as const;

const temperatureAxis = {
  label: 'Temperature',
  scale: 'log',
  domain: [T_MIN, T_MAX],
  format: { maximumFractionDigits: 2 },
} as const;

const temperatures = Array.from(
  { length: CURVE_POINTS },
  (_, index) => T_MIN * (T_MAX / T_MIN) ** (index / (CURVE_POINTS - 1)),
);

/** The four candidates' probabilities now, as bars. */
function TokenBars({ title }: { readonly title: string }): ReactNode {
  const { values, locale } = useLesson(temperatureLesson);

  return (
    <BarChart
      title={title}
      description="Synthetic scores for four candidate next tokens, after the softmax."
      locale={locale}
      categories={candidates.map(({ id, label }) => ({ id, label }))}
      series={[
        {
          id: 'probability',
          label: 'Probability',
          tone: 'series1',
          values: shares(values.temperature, values.trainStep),
        },
      ]}
      domain={[0, 1]}
      valueFormat={{ style: 'percent', maximumFractionDigits: 1 }}
      tickFormat={percent}
      valueLabel="Probability"
      height="compact"
    />
  );
}

/** Each candidate's probability across every temperature, with the current one marked. */
function TemperatureCurves(): ReactNode {
  const { values, locale } = useLesson(temperatureLesson);
  const marker = formatValue({ value: values.temperature, locale, format: { maximumFractionDigits: 2 } });

  return (
    <CurveChart
      title="Probability by temperature"
      description="Each line is one candidate token; the guide marks the temperature the lesson is at."
      locale={locale}
      series={candidates.map((candidate, index) => ({
        id: candidate.id,
        label: candidate.label,
        points: temperatures.map((temperature) => ({
          x: temperature,
          y: shares(temperature, values.trainStep)[index] ?? 0,
        })),
      }))}
      x={temperatureAxis}
      y={{ label: 'Probability', domain: [0, 1], format: percent }}
      markers={[{ x: values.temperature, label: `T = ${marker}` }]}
      labels="inline"
      height="compact"
    />
  );
}

/** The entropy of the distribution across every temperature, against its two-bit ceiling. */
function EntropyCurve(): ReactNode {
  const { values, locale } = useLesson(temperatureLesson);

  return (
    <CurveChart
      title="Entropy by temperature"
      description="Entropy of the four-token distribution, in bits."
      locale={locale}
      series={[
        {
          id: 'entropy',
          label: 'Entropy',
          tone: 'series3',
          points: temperatures.map((temperature) => ({
            x: temperature,
            y: bits(shares(temperature, values.trainStep)),
          })),
        },
      ]}
      x={temperatureAxis}
      y={{ label: 'Entropy (bits)', domain: [0, 2.6], format: { maximumFractionDigits: 1 } }}
      references={[{ id: 'ceiling', label: 'Four equal tokens', y: 2 }]}
      markers={[{ x: values.temperature, label: 'Now' }]}
      labels="none"
      height="compact"
    />
  );
}

const styles = stylex.create({
  fraction: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginInline: spacing.xxs,
  },
  numerator: {
    paddingInline: spacing.xxs,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: 'currentColor',
  },
  variable: { fontStyle: 'italic' },
  display: { letterSpacing: '0.02em' },
});

const symbols: ReadonlyMap<string, string> = new Map([
  ['sum', 'Σ'],
  ['cdot', '·'],
  ['log', 'log'],
  ['approx', '≈'],
  ['ge', '≥'],
  ['le', '≤'],
]);

const TEX_TOKEN =
  /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}|([_^])(?:\{((?:[^{}]|\{[^{}]*\})*)\}|(\S))|\\([a-zA-Z]+)|([a-zA-Z])|(.)/gsu;

/**
 * A tiny stand-in typesetter for the stories: fractions, sub- and superscripts, a few symbols and italic variables. An
 * application passes a real one, such as KaTeX's MathML output turned into React nodes.
 */
export const standInMath: ArticleMath = (tex, { isDisplay }) => {
  function nodes(source: string): ReactNode {
    return [...source.matchAll(TEX_TOKEN)].map((match) => {
      const [, numerator, denominator, mark, group, single, command, letter, other] = match;
      const key = `${match.index}`;

      if (numerator !== undefined && denominator !== undefined) {
        return (
          <span key={key} {...stylex.props(styles.fraction)}>
            <span {...stylex.props(styles.numerator)}>{nodes(numerator)}</span>
            <span>{nodes(denominator)}</span>
          </span>
        );
      }

      if (mark !== undefined) {
        const inner = nodes(group ?? single ?? '');

        return mark === '^' ? <sup key={key}>{inner}</sup> : <sub key={key}>{inner}</sub>;
      }

      if (command !== undefined) {
        return <span key={key}>{symbols.get(command) ?? command}</span>;
      }

      return letter === undefined ? (
        (other ?? '')
      ) : (
        <span key={key} {...stylex.props(styles.variable)}>
          {letter}
        </span>
      );
    });
  }

  return <span {...stylex.props(isDisplay && styles.display)}>{nodes(tex)}</span>;
};

const temperatureReferences: ReadonlyArray<ReferenceItem> = [
  {
    id: 'bridle1990',
    authors: ['John S. Bridle'],
    title:
      'Probabilistic interpretation of feedforward classification network outputs, with relationships to statistical pattern recognition',
    year: 1990,
    venue: 'Neurocomputing, NATO ASI Series',
  },
  {
    id: 'hinton2015',
    authors: ['Geoffrey Hinton', 'Oriol Vinyals', 'Jeff Dean'],
    title: 'Distilling the knowledge in a neural network',
    year: 2015,
    venue: 'arXiv:1503.02531',
    url: 'https://arxiv.org/abs/1503.02531',
  },
  {
    id: 'victor2011',
    authors: ['Bret Victor'],
    title: 'Explorable explanations',
    year: 2011,
    url: 'https://worrydream.com/ExplorableExplanations/',
  },
];

/** The tones every figure and term of the essay share: one hue per candidate token. */
export const temperatureTones = { paris: 'series1', lyon: 'series2', rome: 'series3', cheese: 'series4' } as const;

/** The essay itself, written once and arranged by each view. Its numbers are synthetic. */
export const temperatureEssay = (
  <>
    <Beat id="scores">
      <p>
        A language model finishing “The capital of France is ___” gives every token in its vocabulary a score, a logit.
        Here four candidates stand in for the vocabulary, with synthetic scores. The softmax turns scores into
        probabilities that add up to one
        <Footnote id="name">
          The name is Bridle’s: a smooth, differentiable version of picking the maximum.
        </Footnote>{' '}
        <Cite id="bridle1990" />:
      </p>
      <TeX isDisplay>{String.raw`p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}`}</TeX>
      <Aside>
        Dividing every score by the same number never changes their order, so the most likely token stays the most
        likely.
      </Aside>
      <p>
        The temperature <TeX>{'T'}</TeX> divides every score before the softmax. At a temperature of{' '}
        <Param name="temperature" />, <Term inspects="paris">Paris</Term> takes <Value name="top" /> of the probability
        (<FigureReference to="bars" />
        ).
      </p>

      <Figure
        id="bars"
        caption="The four candidates after the softmax at the current temperature."
        description="A bar chart of four probabilities. Paris is the tallest bar at every temperature; lower temperatures make it taller and the others shorter."
        reads={['temperature']}
      >
        <TokenBars title="Next-token probabilities" />
      </Figure>
    </Beat>
    <Beat id="temperature">
      <p>
        Scroll through three temperatures. Each line in the figure is one candidate, from{' '}
        <Term inspects="paris">Paris</Term> to <Term inspects="cheese">cheese</Term>.
      </p>
      <Scrolly
        figure={
          <Figure
            id="curves"
            caption="Each candidate’s probability across temperatures, with the current one marked."
            description="Four lines over a log temperature axis. Paris falls from almost 100% at low temperature toward 25%, while the other three rise toward 25%."
            reads={['temperature']}
          >
            <TemperatureCurves />
          </Figure>
        }
      >
        <ScrollyStep id="cold" state="cold">
          <p>
            <strong>Cold.</strong> At <TeX>{'T = 0.25'}</TeX> the scores are multiplied by four. The gap between Paris
            and Lyon grows, and almost all the probability lands on Paris.
          </p>
        </ScrollyStep>
        <ScrollyStep id="warm" state="warm">
          <p>
            <strong>Warm.</strong> At <TeX>{'T = 1'}</TeX> the softmax sees the raw scores. Paris leads, but Lyon and
            Rome keep a real share.
          </p>
        </ScrollyStep>
        <ScrollyStep id="hot" state="hot">
          <p>
            <strong>Hot.</strong> At <TeX>{'T = 4'}</TeX> the scores shrink toward zero and the distribution flattens.
            Sampling now often picks a token the model scored low. Distillation uses this softer view of a teacher{' '}
            <Cite id="hinton2015" />.
          </p>
        </ScrollyStep>
      </Scrolly>
    </Beat>
    <Beat id="entropy">
      <p>
        Entropy counts the spread in bits: zero when one token takes everything, two when four tokens share equally. At{' '}
        <Param name="temperature" /> the distribution has <Value name="entropy" />.
      </p>
      <Predict
        id="entropy-guess"
        prompt={<>Before you look at the figure: at the temperature you have now, how many bits of entropy are left?</>}
        min={0}
        max={2}
        step={0.05}
        format={{ style: 'unit', unit: 'bit', maximumFractionDigits: 2 }}
        answerFrom="entropy"
        tolerance={0.15}
      >
        <p>
          Entropy rises quickly between <TeX>{'T = 0.5'}</TeX> and <TeX>{'T = 2'}</TeX>, then levels off: four tokens
          can never hold more than <TeX>{String.raw`\log_2 4 = 2`}</TeX> bits.
        </p>
      </Predict>
      <Figure
        id="entropy"
        caption="Entropy across temperatures, against the two-bit ceiling of four equal tokens."
        description="A single rising curve that flattens just under two bits as the temperature grows."
        reads={['temperature']}
      >
        <EntropyCurve />
      </Figure>
      <Reveal at={1}>
        <p>
          The ceiling is why very high temperatures stop helping: past <TeX>{String.raw`T \approx 4`}</TeX> every token
          is already close to equally likely.
          <Footnote id="vocabulary">A real vocabulary of 50,000 tokens has a ceiling near 15.6 bits.</Footnote>
        </p>
      </Reveal>
    </Beat>
    <Beat id="confidence">
      <Challenge
        id="confident"
        prompt={<>Make the model at least 90% sure of “Paris”, without training it.</>}
        isReached={(values) => Number(values['top']) >= CONFIDENT && values['trainStep'] === 0}
        hints={['A lower temperature sharpens the distribution.', 'Try a temperature below 0.6.']}
      >
        <p>
          At <Param name="temperature" /> Paris has <Value name="top" />. Greedy decoding is the limit of this move: a
          temperature near zero.
        </p>
      </Challenge>
      <Figure
        id="bars-confidence"
        caption="The same bars, for the challenge."
        description="The four candidate probabilities at the current temperature."
        reads={['temperature']}
      >
        <TokenBars title="Next-token probabilities" />
      </Figure>
      <p>
        The temperature is <Param name="temperature" />.
      </p>
    </Beat>
    <Beat id="training">
      <p>
        Training changes the scores themselves. Play the run: at step <Value name="trainStep" /> Paris takes{' '}
        <Value name="top" /> at temperature <Value name="temperature" />.
      </p>
      <Playback name="trainStep" pace="slow" />
      <Figure
        id="training"
        caption="The candidates as training sharpens the scores, at a fixed temperature."
        description="Four bars. As training proceeds, Paris grows and the other three shrink, as if the temperature were lowered."
        reads={['trainStep']}
      >
        <TokenBars title="Next-token probabilities during training" />
        <Transport for="trainStep" />
      </Figure>
      <Reveal at={1}>
        <p>
          Training and temperature act on the same thing, the gaps between scores. That is why a model trained longer
          can look as if it ran colder <Cite id="victor2011" />.
        </p>
      </Reveal>
      <Challenge id="trained" prompt="Play the training run past step 30." isReached={isTrained}>
        <p>
          Paris now takes <Value name="top" /> at the same temperature: training did what a colder temperature would.
        </p>
      </Challenge>
    </Beat>
    <References items={temperatureReferences} />
  </>
);

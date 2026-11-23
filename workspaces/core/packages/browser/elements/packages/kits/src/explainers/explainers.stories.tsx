import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartLink, ToneScope } from '../../../charts/src/index.ts';
import { CurveChart } from '../../../charts/src/trend/index.ts';
import type { CurveSeries } from '../../../charts/src/trend/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { BoundValue } from './bound-value.tsx';
import { Explainer, FigureReference, NumberedFigure } from './figures.tsx';
import { StorySteps } from './story-steps.tsx';
import type { StoryStep } from './story-steps.tsx';
import { DiagramPart, Term } from './term.tsx';

const meta = {
  title: 'Kits/Explainers',
  component: Explainer,
  subcomponents: { NumberedFigure, FigureReference, StorySteps, Term, DiagramPart, BoundValue },
  parameters: {
    docs: {
      description: {
        component:
          'Pieces that make a long page read like an article whose prose and figures talk to each other. Explainer numbers figures from a list of ids; StorySteps walks through observations and points the figures at each one; Term and DiagramPart link words and drawn parts to records; BoundValue is a number in a sentence the reader drags or steps. The application owns every value, and nothing moves on its own.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const FIRST_STEP = 100;
const LAST_STEP = 100_000;
const SAMPLES = 25;
const BASE_EXPONENT = 0.12;

const steps = Array.from({ length: SAMPLES }, (_, index) =>
  Math.round(FIRST_STEP * (LAST_STEP / FIRST_STEP) ** (index / (SAMPLES - 1))),
);

/** A closed-form loss curve: an irreducible floor plus a power law in the training step. */
function lossCurve({
  scale,
  exponent,
  floor,
}: {
  readonly scale: number;
  readonly exponent: number;
  readonly floor: number;
}) {
  return steps.map((step) => ({ x: step, y: floor + scale * (step / FIRST_STEP) ** -exponent }));
}

/** Width multiplies the useful compute per step, which shows up as a steeper exponent. */
function runs(width: number): ReadonlyArray<CurveSeries> {
  return [
    { id: 'base', label: 'Base (width 1×)', points: lossCurve({ scale: 2.4, exponent: BASE_EXPONENT, floor: 1.6 }) },
    {
      id: 'wide',
      label: `Wide (width ${width}×)`,
      points: lossCurve({ scale: 2.4, exponent: BASE_EXPONENT * (1 + Math.log2(width) / 2), floor: 1.6 }),
    },
  ];
}

const stepAxis = { label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } } as const;
const ratio = { maximumFractionDigits: 2 } as const;

const styles = stylex.create({
  page: {
    display: 'grid',
    gap: spacing.xl,
    maxWidth: 960,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  prose: { margin: 0, maxWidth: '68ch', fontSize: typography.inputSize, lineHeight: typography.proseLineHeight },
  heading: { margin: 0, fontSize: typography.compactHeadingSize, lineHeight: typography.compactHeadingLineHeight },
  diagram: { display: 'block', width: '100%', maxWidth: 420, height: 'auto' },
  label: {
    fill: colors.ink,
    stroke: 'none',
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    pointerEvents: 'none',
  },
  arrow: { stroke: colors.faint, strokeWidth: 1.5, fill: 'none' },
});

function Diagram(): ReactNode {
  return (
    <svg viewBox="0 0 420 120" role="group" aria-label="Two runs from one dataset" {...stylex.props(styles.diagram)}>
      <rect x="4" y="44" width="96" height="32" rx="4" {...stylex.props(styles.arrow)} />
      <text x="52" y="64" textAnchor="middle" {...stylex.props(styles.label)}>
        Dataset
      </text>
      <path d="M100 60 C 150 60, 150 24, 200 24 M100 60 C 150 60, 150 96, 200 96" {...stylex.props(styles.arrow)} />
      <DiagramPart inspects="base" label="Base model, width 1">
        <rect x="200" y="8" width="120" height="32" rx="4" />
        <text x="260" y="28" textAnchor="middle" {...stylex.props(styles.label)}>
          Base model
        </text>
      </DiagramPart>
      <DiagramPart inspects="wide" label="Wide model">
        <rect x="200" y="80" width="200" height="32" rx="4" />
        <text x="300" y="100" textAnchor="middle" {...stylex.props(styles.label)}>
          Wide model
        </text>
      </DiagramPart>
    </svg>
  );
}

function observations(width: number): ReadonlyArray<StoryStep> {
  return [
    {
      id: 'start',
      title: 'Both runs start level',
      body: (
        <>
          At step 100 <Term inspects="base">the base run</Term> and <Term inspects="wide">the wide run</Term> share one
          loss: width has not paid off yet.
        </>
      ),
      inspected: String(FIRST_STEP),
    },
    {
      id: 'split',
      title: 'The curves part within a few thousand steps',
      body: (
        <>
          The wider model learns more per step, so its curve in <FigureReference to="loss" /> falls below the base curve
          and keeps pulling away.
        </>
      ),
      inspected: String(steps[12]),
    },
    {
      id: 'ratio',
      title: `At ${width}× width the gap keeps growing`,
      body: (
        <>
          By the last step the wide run sits well below the base run. <FigureReference to="gap" /> shows the ratio of
          the two losses at every step.
        </>
      ),
      inspected: String(LAST_STEP),
    },
  ];
}

function ExplainerPage(): ReactNode {
  const [width, setWidth] = useState(4);
  const [step, setStep] = useState('start');
  const series = runs(width);
  const [base, wide] = series;

  const gap: ReadonlyArray<CurveSeries> = [
    {
      id: 'wide',
      label: 'Wide ÷ base',
      points: steps.map((sample, index) => ({
        x: sample,
        y: (wide?.points[index]?.y ?? 1) / (base?.points[index]?.y ?? 1),
      })),
    },
  ];

  return (
    <ToneScope ids={['base', 'wide']}>
      <ChartLink defaultInspected={String(FIRST_STEP)}>
        <Explainer figures={['setup', 'loss', 'gap']}>
          <article {...stylex.props(styles.page)}>
            <h1 {...stylex.props(styles.heading)}>Why width pays off late</h1>
            <p {...stylex.props(styles.prose)}>
              Synthetic, closed-form runs. Two models train on one dataset (<FigureReference to="setup" />
              ). The wide one has{' '}
              <BoundValue
                value={width}
                onValueChange={setWidth}
                min={1}
                max={16}
                step={1}
                scale="log"
                locale="en-US"
                format={{ maximumFractionDigits: 0 }}
                label="Width multiplier of the wide run"
              />
              × the width of the base one; drag the number or use the arrow keys to change it, and watch{' '}
              <Term inspects="wide">its curve</Term> move.
            </p>
            <StorySteps steps={observations(width)} step={step} onStepChange={setStep} label="Reading the curves">
              <NumberedFigure id="setup" caption="Both runs share data and steps; only width differs.">
                <Diagram />
              </NumberedFigure>
              <NumberedFigure id="loss" caption="Validation loss for each run, on a log step axis.">
                <CurveChart
                  title="Validation loss"
                  locale="en-US"
                  series={series}
                  x={stepAxis}
                  y={{ label: 'Loss (nats)', domain: [1.5, 4.5], format: ratio }}
                  height="compact"
                />
              </NumberedFigure>
              <NumberedFigure id="gap" caption="The wide run's loss as a share of the base run's loss.">
                <CurveChart
                  title="Loss ratio"
                  locale="en-US"
                  series={gap}
                  x={stepAxis}
                  y={{ label: 'Wide ÷ base loss', domain: [0.5, 1], format: { style: 'percent' } }}
                  height="compact"
                />
              </NumberedFigure>
            </StorySteps>
            <p {...stylex.props(styles.prose)}>
              A reference to a figure the explainer does not list fails loudly: <FigureReference to="appendix" />.
            </p>
          </article>
        </Explainer>
      </ChartLink>
    </ToneScope>
  );
}

export const Article: Story = { render: () => <ExplainerPage /> };

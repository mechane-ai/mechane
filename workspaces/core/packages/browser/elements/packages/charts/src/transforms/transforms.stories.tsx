import type { Meta, StoryObj } from '@storybook/react-vite';
import { CurveChart } from '../trend/curve-chart.tsx';
import type { CurveSeries } from '../trend/curve-chart.tsx';
import { describePowerLawFit, powerLawFit } from './fits.ts';
import { describeDownsample, downsample } from './sampling.ts';
import { describeExponentialSmoothing, exponentialSmoothing } from './smoothing.ts';
import type { SeriesPoint } from './values.ts';

const meta = {
  title: 'Charts/Transforms',
  component: CurveChart,
  parameters: {
    docs: {
      description: {
        component:
          'The transforms prepare values a chart then draws as given: bins, quantiles, densities, smoothing, fits, run summaries and samples. Each has a describe helper whose sentence goes in the figure’s `transforms` footnote. Here a synthetic noisy loss is smoothed and fitted over all 6,000 checkpoints, then thinned for drawing.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const LOCALE = 'en-US';
const FIRST_STEP = 10;
const CHECKPOINTS = 6000;
const GROWTH = 1.0015;
const DRAWN_POINTS = 400;

/** A synthetic power-law loss, logged at geometrically spaced steps, with deterministic noise and two logging gaps. */
const raw: ReadonlyArray<SeriesPoint> = Array.from({ length: CHECKPOINTS }, (_, index) => {
  const x = FIRST_STEP * GROWTH ** index;
  const isFirstGap = index >= 2600 && index < 2900;
  const isSecondGap = index >= 4700 && index < 4850;
  const isGap = isFirstGap || isSecondGap;
  const noise = 0.05 * Math.sin(index * 12.9898) + 0.03 * Math.sin(index * 0.731);

  return { x, y: isGap ? null : 5.6 * x ** -0.11 * (1 + noise) };
});

const smoothed = exponentialSmoothing({ points: raw, weight: 0.95 });
const fit = powerLawFit(raw);
const thinRaw = downsample({ points: raw, target: DRAWN_POINTS, unit: 'checkpoints' });
const thinSmoothed = downsample({ points: smoothed.kind === 'ok' ? smoothed.points : [], target: DRAWN_POINTS });

const series: ReadonlyArray<CurveSeries> = [
  { id: 'raw', label: 'Logged loss', isContext: true, points: thinRaw.kind === 'ok' ? thinRaw.points : [] },
  { id: 'smoothed', label: 'Smoothed', points: thinSmoothed.kind === 'ok' ? thinSmoothed.points : [] },
  {
    id: 'fit',
    label: 'Power-law fit',
    stroke: 'dashed',
    tone: 'neutral',
    points: fit.kind === 'ok' ? fit.fitted.filter((_, index, all) => index % 50 === 0 || index === all.length - 1) : [],
  },
];

const notes = [
  smoothed.kind === 'ok' ? describeExponentialSmoothing({ result: smoothed, locale: LOCALE }) : undefined,
  fit.kind === 'ok' ? describePowerLawFit({ result: fit, locale: LOCALE }) : undefined,
  thinRaw.kind === 'ok' ? describeDownsample({ result: thinRaw, locale: LOCALE }) : undefined,
].filter((note) => note !== undefined);

export const SmoothedLossWithFit: Story = {
  render: () => (
    <CurveChart
      title="Training loss"
      description="Synthetic run. Gray: logged loss; solid: debiased exponential moving average; dashed: power-law fit."
      locale={LOCALE}
      series={series}
      x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Loss (nats)', format: { maximumFractionDigits: 2 } }}
      coverage={thinRaw.kind === 'ok' ? thinRaw.coverage : undefined}
      source="Synthetic run"
      transforms={notes}
    />
  ),
};

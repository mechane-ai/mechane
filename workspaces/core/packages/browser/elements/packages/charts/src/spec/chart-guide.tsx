import { figureRegistry } from './figure-registry.tsx';
import type { FigureChart, FigureFamily, FigureSpec, FigureSpecOf } from './figure-spec.ts';
import { bell, days, decay, peaks, range, round, share, tile, timed, wave } from './guide-data.ts';

/** What the guide says about a chart: the question it answers, when to choose it and when another chart is better. */
export type ChartGuideText = {
  /** The question the chart answers, in a reader's words. */
  readonly question: string;
  /** When this chart is the right choice. */
  readonly use: string;
  /** When another chart is better, naming it. */
  readonly avoid: string;
};

/** One chart in the guide, with a small, valid spec that shows it at its best. */
export type ChartGuideEntry = ChartGuideText & {
  readonly chart: FigureChart;
  readonly family: FigureFamily;
  readonly example: FigureSpec;
};

type ChartGuideBook = { readonly [Chart in FigureChart]: ChartGuideText & { readonly example: FigureSpecOf<Chart> } };

const time = {
  start: Date.UTC(2026, 10, 16),
  hour: 3_600_000,
  minute: 60_000,
  day: 86_400_000,
  clock: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' },
  date: { month: 'short', day: 'numeric', timeZone: 'UTC' },
} as const;

const formats = {
  integer: { maximumFractionDigits: 0 },
  decimal: { maximumFractionDigits: 2 },
  percent: { style: 'percent', maximumFractionDigits: 1 },
  milliseconds: { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 },
  dollars: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
} as const;

const steps = [100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000] as const;

const benchmarks = [
  { id: 'mmlu', label: 'MMLU' },
  { id: 'gsm8k', label: 'GSM8K' },
  { id: 'humaneval', label: 'HumanEval' },
  { id: 'arc', label: 'ARC-Challenge' },
  { id: 'truthfulqa', label: 'TruthfulQA' },
] as const;

const sentence = ['The', ' cat', ' sat', ' on', ' the', ' mat', ' because', ' it', ' was', ' warm'] as const;
const sentenceTokens = sentence.map((text, index) => ({ id: `t${index}`, index, text }));

const book: ChartGuideBook = {
  CurveChart: {
    question: 'How did a metric change over training steps or another ordered variable?',
    use: 'Use it for loss, accuracy or any measure over steps, layers or doses, on linear or log axes, with bands for spread across seeds.',
    avoid:
      'Use LineChart when the ordered variable is a timestamp, and RunsChart when there are dozens of runs to show as context.',
    example: {
      chart: 'CurveChart',
      props: {
        title: 'Validation loss',
        description: 'Synthetic runs. Bands span three seeds; the dashed line is a fitted power law.',
        locale: 'en-US',
        series: [
          { id: 'base', label: 'Base', points: decay({ xs: steps, start: 4.2, floor: 1.9, rate: 1.1, spread: 0.06 }) },
          { id: 'wide', label: 'Wide', points: decay({ xs: steps, start: 4.1, floor: 1.6, rate: 1.3, spread: 0.06 }) },
          {
            id: 'fit',
            label: 'Power-law fit',
            stroke: 'dashed',
            tone: 'neutral',
            points: decay({ xs: steps, start: 4, floor: 1.4, rate: 1 }),
          },
        ],
        x: { label: 'Training step', scale: 'log', format: formats.integer },
        y: { label: 'Loss (nats)', domain: [1, 5], format: formats.decimal },
        references: [{ id: 'target', label: 'Target', y: 1.75 }],
        source: 'Synthetic sweep',
        transforms: ['Mean of three seeds'],
      },
    },
  },
  RunsChart: {
    question: 'How does one run compare with the whole sweep it belongs to?',
    use: 'Use it for many training runs at once: every run stays gray context and only the runs you name are drawn in color.',
    avoid: 'Use CurveChart for a handful of series that each deserve a color and a legend entry.',
    example: {
      chart: 'RunsChart',
      props: {
        title: 'Learning-rate sweep',
        description: 'Synthetic sweep of twelve runs. The featured runs are the best and the default.',
        locale: 'en-US',
        runs: range({ count: 12 }).map((index) => ({
          id: `run-${index}`,
          label: `lr ${(index + 1) * 0.5}e-4`,
          points: decay({ xs: steps, start: 4.4, floor: 1.7 + Math.abs(index - 5) * 0.08, rate: 0.9 + index * 0.03 }),
        })),
        featured: ['run-5', 'run-1'],
        x: { label: 'Training step', scale: 'log', format: formats.integer },
        y: { label: 'Loss (nats)', domain: [1, 5], format: formats.decimal },
        source: 'Synthetic sweep',
      },
    },
  },
  SlopeChart: {
    question: 'How did each item move between two to six conditions?',
    use: 'Use it to compare before and after, or a few checkpoints, where the direction of each change matters more than the path.',
    avoid:
      'Use DumbbellPlot when there are many rows and exactly two conditions, and CurveChart when the conditions are many ordered steps.',
    example: {
      chart: 'SlopeChart',
      props: {
        title: 'Benchmark accuracy before and after tuning',
        description: 'Synthetic scores for five benchmarks.',
        locale: 'en-US',
        conditions: [
          { id: 'base', label: 'Base' },
          { id: 'sft', label: 'Fine-tuned' },
          { id: 'rl', label: 'After RL' },
        ],
        items: benchmarks.map((benchmark, index) => ({
          ...benchmark,
          values: [
            share(0.52 + index * 0.05),
            share(0.6 + index * 0.04),
            share(0.63 + index * (index === 4 ? 0 : 0.045)),
          ],
        })),
        value: { label: 'Accuracy', domain: [0.4, 1], format: formats.percent },
      },
    },
  },
  BumpChart: {
    question: 'How did the ranking of items change across stages?',
    use: 'Use it when the order matters more than the values: a leaderboard over releases, or model rank per evaluation round.',
    avoid: 'Use SlopeChart or CurveChart when the size of the gaps between items matters.',
    example: {
      chart: 'BumpChart',
      props: {
        title: 'Leaderboard rank by release',
        description: 'Synthetic ranks of five models across four releases.',
        locale: 'en-US',
        stages: ['v1', 'v2', 'v3', 'v4'].map((id) => ({ id, label: id.toUpperCase() })),
        items: [
          { id: 'atlas', label: 'Atlas', ranks: [1, 1, 2, 3] },
          { id: 'boreal', label: 'Boreal', ranks: [3, 2, 1, 1] },
          { id: 'cirrus', label: 'Cirrus', ranks: [2, 3, 3, 2] },
          { id: 'delta', label: 'Delta', ranks: [5, 4, 4, 5] },
          { id: 'ember', label: 'Ember', ranks: [4, 5, 5, 4] },
        ],
      },
    },
  },
  HorizonChart: {
    question: 'Which of many series run above or below normal, and when?',
    use: 'Use it for dozens of aligned series in little height, such as the error rate of every service over a day.',
    avoid: 'Use LineChart or SmallMultiples when there are only a few series and readers need exact levels.',
    example: {
      chart: 'HorizonChart',
      props: {
        title: 'Error rate against baseline by service',
        description: 'Synthetic deviation from each service’s weekly baseline, in percentage points.',
        locale: 'en-US',
        series: ['gateway', 'tokenizer', 'scheduler', 'retrieval', 'inference', 'billing'].map((id, index) => ({
          id,
          label: id[0]?.toUpperCase() + id.slice(1),
          points: wave({
            count: 48,
            base: 0,
            amplitude: 1.2 + index * 0.3,
            cycle: 16 + index * 3,
            phase: index * 4,
          }).map((y, step) => ({ x: step * 0.5, y })),
        })),
        x: { label: 'Hour of day (UTC)', domain: [0, 24], format: formats.integer },
        value: { label: 'Deviation (points)', domain: [-3, 3], format: formats.decimal },
        bands: 3,
      },
    },
  },
  DotPlot: {
    question: 'How do a few models compare on each of several measures?',
    use: 'Use it to compare values across categories without bars, when the axis need not start at zero and intervals matter.',
    avoid: 'Use BarChart when the amount itself, measured from zero, is the point.',
    example: {
      chart: 'DotPlot',
      props: {
        title: 'Accuracy by benchmark',
        description: 'Synthetic scores with 95% bootstrap intervals.',
        locale: 'en-US',
        rows: benchmarks,
        series: [
          { id: 'small', label: 'Small', offset: 0 },
          { id: 'large', label: 'Large', offset: 0.12 },
        ].map(({ id, label, offset }) => ({
          id,
          label,
          values: Object.fromEntries(benchmarks.map((row, index) => [row.id, share(0.5 + offset + index * 0.04)])),
          intervals: Object.fromEntries(
            benchmarks.map((row, index) => [
              row.id,
              { lower: share(0.47 + offset + index * 0.04), upper: share(0.53 + offset + index * 0.04) },
            ]),
          ),
        })),
        value: { label: 'Accuracy', domain: [0.4, 0.9], format: formats.percent },
      },
    },
  },
  DumbbellPlot: {
    question: 'How much did each row change between two measurements?',
    use: 'Use it for many rows with exactly two values each, such as scores before and after fine-tuning.',
    avoid:
      'Use SlopeChart for few rows or more than two conditions, and BridgeChart for how parts add up to a total change.',
    example: {
      chart: 'DumbbellPlot',
      props: {
        title: 'Accuracy before and after fine-tuning',
        description: 'Synthetic scores for five benchmarks.',
        locale: 'en-US',
        rows: benchmarks.map((row, index) => ({
          ...row,
          from: share(0.48 + index * 0.05),
          to: share(0.58 + index * 0.05 - (index === 4 ? 0.13 : 0)),
        })),
        fromLabel: 'Before fine-tuning',
        toLabel: 'After fine-tuning',
        value: { label: 'Accuracy', domain: [0.4, 0.9], format: formats.percent },
      },
    },
  },
  BulletBar: {
    question: 'Is each measure meeting its target?',
    use: 'Use it for a few key measures held against targets and qualitative bands, such as latency against its objective.',
    avoid: 'Use BarChart when there are no targets, and a table when readers need many exact values.',
    example: {
      chart: 'BulletBar',
      props: {
        title: 'p95 latency against objectives',
        description: 'Synthetic. Bands mark good, acceptable and poor.',
        locale: 'en-US',
        rows: [
          { id: 'chat', label: 'Chat', value: 620, target: 800 },
          { id: 'embed', label: 'Embeddings', value: 140, target: 120 },
          { id: 'search', label: 'Search', value: 410, target: 500 },
          { id: 'batch', label: 'Batch', value: 950, target: 1200 },
        ].map((row) => ({
          ...row,
          ranges: [
            { upTo: row.target, label: 'Good' },
            { upTo: row.target * 1.25, label: 'Acceptable' },
            { upTo: 2000, label: 'Poor' },
          ],
        })),
        value: { label: 'p95 latency (ms)', domain: [0, 2000], format: formats.milliseconds },
      },
    },
  },
  BarChart: {
    question: 'How large is each amount, by category and series?',
    use: 'Use it for amounts measured from zero across a few categories, grouped or stacked by series.',
    avoid: 'Use DotPlot when the values do not start at zero, and LineChart when the categories are instants.',
    example: {
      chart: 'BarChart',
      props: {
        title: 'Tokens by operation',
        description: 'Synthetic daily totals. Embeddings produce no output tokens.',
        locale: 'en-US',
        categories: [
          { id: 'chat', label: 'Chat' },
          { id: 'embed', label: 'Embeddings' },
          { id: 'batch', label: 'Batch' },
          { id: 'eval', label: 'Evaluation' },
        ],
        series: [
          { id: 'input', label: 'Input tokens', values: [42_000_000, 18_400_000, 31_200_000, 9_100_000] },
          { id: 'output', label: 'Output tokens', values: [27_300_000, 0, 22_800_000, 6_400_000] },
        ],
        valueLabel: 'Tokens',
        valueFormat: { notation: 'compact', maximumFractionDigits: 1 },
        source: 'Synthetic usage log',
      },
    },
  },
  BridgeChart: {
    question: 'Which changes add up to the difference between two totals?',
    use: 'Use it to explain a change from one total to another as a sequence of signed parts, such as cost by cause.',
    avoid: 'Use BarChart when the parts are independent amounts, not steps from one total to the next.',
    example: {
      chart: 'BridgeChart',
      props: {
        title: 'Monthly inference cost, October to November',
        description: 'Synthetic. Each bar is one cause of the change.',
        locale: 'en-US',
        steps: [
          { id: 'oct', label: 'October', kind: 'start', value: 84_000 },
          { id: 'traffic', label: 'More traffic', kind: 'change', value: 21_000 },
          { id: 'cache', label: 'Prompt cache', kind: 'change', value: -9500 },
          { id: 'model', label: 'Larger model', kind: 'change', value: 12_500 },
          { id: 'spot', label: 'Spot capacity', kind: 'change', value: -6000 },
          { id: 'nov', label: 'November', kind: 'total' },
        ],
        valueLabel: 'Monthly cost (USD)',
        valueFormat: formats.dollars,
        source: 'Synthetic billing export',
      },
    },
  },
  BreakdownBar: {
    question: 'How does one total split into parts?',
    use: 'Use it for a single total and a few named parts, such as where the time of a request went.',
    avoid: 'Use Treemap for many parts, and BarChart to compare several totals.',
    example: {
      chart: 'BreakdownBar',
      props: {
        title: 'Where a request’s 840 ms went',
        description: 'Synthetic median request.',
        locale: 'en-US',
        items: [
          { id: 'queue', label: 'Queue', value: 120 },
          { id: 'prefill', label: 'Prefill', value: 260 },
          { id: 'decode', label: 'Decode', value: 380 },
          { id: 'network', label: 'Network', value: 80 },
        ],
        total: 840,
        valueFormat: formats.milliseconds,
      },
    },
  },
  ScatterPlot: {
    question: 'How do two measures of the same records relate?',
    use: 'Use it for up to a thousand records with two measures each, such as cost and accuracy per model.',
    avoid: 'Use EmbeddingMap or DensityMap for many thousands of points, and ScatterMatrix for more than two measures.',
    example: {
      chart: 'ScatterPlot',
      props: {
        title: 'Cost and accuracy per checkpoint',
        description: 'Synthetic checkpoints of two model sizes.',
        locale: 'en-US',
        points: range({ count: 24 }).map((index) => ({
          id: `ckpt-${index}`,
          label: `Checkpoint ${index + 1}`,
          x: 0.4 + (index % 12) * 0.15 + (index >= 12 ? 1.6 : 0),
          y: share(0.55 + Math.log1p(index % 12) * 0.06 + (index >= 12 ? 0.08 : 0)),
          tone: index >= 12 ? 'series2' : 'series1',
        })),
        x: { label: 'Cost per 1k requests (USD)', format: { style: 'currency', currency: 'USD' } },
        y: { label: 'Accuracy', domain: [0.5, 0.9], format: formats.percent },
      },
    },
  },
  LineChart: {
    question: 'How did a measure change over time?',
    use: 'Use it for a few series over timestamps, such as latency per minute or requests per hour.',
    avoid: 'Use CurveChart when the ordered variable is not time, and HorizonChart for dozens of series.',
    example: {
      chart: 'LineChart',
      props: {
        title: 'Request latency',
        description: 'Synthetic p50 and p95 over one day, per hour.',
        locale: 'en-US',
        series: [
          {
            id: 'p50',
            label: 'p50',
            points: timed({
              start: time.start,
              step: time.hour,
              values: wave({ count: 24, base: 180, amplitude: 40, cycle: 24, phase: 18 }),
            }),
          },
          {
            id: 'p95',
            label: 'p95',
            points: timed({
              start: time.start,
              step: time.hour,
              values: wave({ count: 24, base: 520, amplitude: 140, cycle: 24, phase: 18 }),
            }),
          },
        ],
        timestampUnit: 'milliseconds',
        timeFormat: time.clock,
        valueLabel: 'Latency (ms)',
        valueFormat: formats.milliseconds,
        source: 'Synthetic gateway metrics',
      },
    },
  },
  AreaChart: {
    question: 'How did a total and its parts change over time?',
    use: 'Use it stacked for parts that add up to a meaningful total over time, such as requests by region.',
    avoid: 'Use LineChart when the series do not add up, or when readers compare series that are not at the bottom.',
    example: {
      chart: 'AreaChart',
      props: {
        title: 'Requests by region',
        description: 'Synthetic requests per hour, stacked.',
        locale: 'en-US',
        isStacked: true,
        series: [
          { id: 'us', label: 'Americas', base: 4200, phase: 20 },
          { id: 'eu', label: 'Europe', base: 3100, phase: 14 },
          { id: 'ap', label: 'Asia Pacific', base: 2300, phase: 6 },
        ].map(({ id, label, base, phase }) => ({
          id,
          label,
          points: timed({
            start: time.start,
            step: time.hour,
            values: wave({ count: 24, base, amplitude: base * 0.4, cycle: 24, phase }),
          }),
        })),
        timestampUnit: 'milliseconds',
        timeFormat: time.clock,
        valueLabel: 'Requests per hour',
        valueFormat: formats.integer,
      },
    },
  },
  SmallMultiples: {
    question: 'How do several related measures move together over the same time?',
    use: 'Use it for a few measures with different units on one shared time axis, inspected together.',
    avoid: 'Use LineChart when the series share one unit and belong on one plot.',
    example: {
      chart: 'SmallMultiples',
      props: {
        locale: 'en-US',
        timestampUnit: 'milliseconds',
        timeFormat: time.clock,
        height: 'compact',
        charts: [
          {
            id: 'latency',
            title: 'Latency',
            valueLabel: 'Latency (ms)',
            valueFormat: formats.milliseconds,
            series: [
              {
                id: 'latency',
                label: 'p95 latency',
                points: timed({
                  start: time.start,
                  step: time.hour,
                  values: wave({ count: 24, base: 520, amplitude: 140, cycle: 24, phase: 18 }),
                }),
              },
            ],
          },
          {
            id: 'errors',
            title: 'Error rate',
            valueFormat: formats.percent,
            series: [
              {
                id: 'errors',
                label: 'Error rate',
                points: timed({
                  start: time.start,
                  step: time.hour,
                  values: wave({ count: 24, base: 0.012, amplitude: 0.006, cycle: 12, phase: 3 }),
                }),
              },
            ],
          },
        ],
      },
    },
  },
  Sparkline: {
    question: 'Which way is one measure trending, at a glance?',
    use: 'Use it inline beside a number or in a dense summary, where a full chart would be too much.',
    avoid: 'Use LineChart when readers need axes, exact values or several series.',
    example: {
      chart: 'Sparkline',
      props: {
        title: 'p95 latency, last 24 hours',
        summary: 'Latency ranged from 380 to 660 milliseconds and ended at 470.',
        unit: 'milliseconds',
        layout: 'figure',
        timestampUnit: 'milliseconds',
        series: {
          id: 'latency',
          label: 'p95 latency',
          points: timed({
            start: time.start,
            step: time.hour,
            values: wave({ count: 24, base: 520, amplitude: 140, cycle: 24, phase: 18 }),
          }),
        },
        valueDomain: [0, 800],
        markedPoints: ['minimum', 'maximum', 'last'],
      },
    },
  },
  Histogram: {
    question: 'How are the values of one measure distributed?',
    use: 'Use it for the shape of one distribution from prepared bins, such as response lengths or latencies.',
    avoid: 'Use ECDF to read percentiles exactly, and BoxPlot or ViolinPlot to compare several groups.',
    example: {
      chart: 'Histogram',
      props: {
        title: 'Response length',
        description: 'Synthetic: 5,000 responses in bins of 50 tokens.',
        locale: 'en-US',
        bins: bell({ center: 320, width: 110, from: 25, to: 775, count: 16 }).map(({ value, density }) => ({
          id: `bin-${value - 25}`,
          label: `${value - 25}–${value + 25} tokens`,
          lowerBound: value - 25,
          upperBound: value + 25,
          count: Math.round(density * 5000 * 50),
        })),
        value: { label: 'Response length (tokens)', format: formats.integer },
        count: { label: 'Responses', format: formats.integer },
        transforms: ['Binned in steps of 50 tokens'],
      },
    },
  },
  ECDF: {
    question: 'What share of values falls below a given level?',
    use: 'Use it to read percentiles and compare tails exactly, such as the share of requests under a latency objective.',
    avoid: 'Use Histogram when the shape of the distribution matters more than its percentiles.',
    example: {
      chart: 'ECDF',
      props: {
        title: 'Request latency distribution',
        description: 'Synthetic: share of 40 sampled requests at or below each latency.',
        locale: 'en-US',
        points: range({ count: 40 }).map((index) => ({
          id: `r${index}`,
          value: Math.round(120 + 30 * Math.tan(((index + 0.5) / 40 - 0.5) * 2.6) + index * 6),
          probability: share((index + 1) / 40),
        })),
        value: { label: 'Latency (ms)', format: formats.milliseconds },
        probability: { label: 'Share of requests', domain: [0, 1], format: formats.percent },
      },
    },
  },
  IntervalPlot: {
    question: 'What is each estimate, and how uncertain is it?',
    use: 'Use it for estimates with confidence or credible intervals, such as an effect size per benchmark.',
    avoid: 'Use DotPlot to compare several series per row, and BoxPlot to show the spread of raw values.',
    example: {
      chart: 'IntervalPlot',
      props: {
        title: 'Effect of the new prompt, by benchmark',
        description: 'Synthetic difference in accuracy with 95% bootstrap intervals.',
        locale: 'en-US',
        items: benchmarks.map((row, index) => ({
          ...row,
          lower: share(-0.02 + index * 0.012 - 0.025),
          estimate: share(-0.02 + index * 0.012),
          upper: share(-0.02 + index * 0.012 + 0.025),
        })),
        value: { label: 'Change in accuracy', domain: [-0.06, 0.08], format: formats.percent },
        intervalLabel: '95% interval',
      },
    },
  },
  RankedBars: {
    question: 'Which items rank highest on one measure?',
    use: 'Use it for a sorted top list, such as the features or prompts with the largest effect.',
    avoid: 'Use BarChart when the categories have a natural order, and DotPlot when values do not start at zero.',
    example: {
      chart: 'RankedBars',
      props: {
        title: 'Most frequent failure causes',
        description: 'Synthetic counts from 1,200 failed evaluation items.',
        locale: 'en-US',
        items: [
          { id: 'format', label: 'Wrong output format', value: 412 },
          { id: 'math', label: 'Arithmetic slip', value: 287 },
          { id: 'refusal', label: 'Unneeded refusal', value: 196 },
          { id: 'halluc', label: 'Unsupported claim', value: 171 },
          { id: 'truncate', label: 'Truncated answer', value: 134 },
        ].map((item, index) => ({ ...item, rank: `${index + 1}` })),
        value: { label: 'Failed items', format: formats.integer },
      },
    },
  },
  BoxPlot: {
    question: 'How do the distributions of several groups compare?',
    use: 'Use it for prepared quartiles of a handful of groups, such as latency per region, with outliers marked.',
    avoid: 'Use ViolinPlot when the shape matters, and StripPlot when there are few enough values to show each.',
    example: {
      chart: 'BoxPlot',
      props: {
        title: 'Latency by region',
        description: 'Synthetic quartiles of one day of requests. Whiskers reach 1.5 times the interquartile range.',
        locale: 'en-US',
        groups: [
          { id: 'us', label: 'Americas', low: 90, q1: 160, median: 210, q3: 290, high: 470, outliers: [620, 710] },
          { id: 'eu', label: 'Europe', low: 110, q1: 180, median: 240, q3: 320, high: 520, outliers: [680] },
          {
            id: 'ap',
            label: 'Asia Pacific',
            low: 140,
            q1: 230,
            median: 300,
            q3: 410,
            high: 650,
            outliers: [780, 820, 905],
          },
        ],
        value: { label: 'Latency (ms)', format: formats.milliseconds },
        whiskerLabel: '1.5 × IQR',
        transforms: ['Quartiles of each region’s requests'],
      },
    },
  },
  ViolinPlot: {
    question: 'How does the shape of a distribution differ between groups?',
    use: 'Use it for prepared densities of a few groups when bimodality or skew matters, such as reward per policy.',
    avoid: 'Use BoxPlot when quartiles are enough, and Ridgeline for many groups in order.',
    example: {
      chart: 'ViolinPlot',
      props: {
        title: 'Reward by policy',
        description: 'Synthetic kernel density of episode reward.',
        locale: 'en-US',
        groups: [
          { id: 'base', label: 'Base', center: 0.2, width: 0.18 },
          { id: 'ppo', label: 'PPO', center: 0.45, width: 0.14 },
          { id: 'dpo', label: 'DPO', center: 0.52, width: 0.2 },
        ].map(({ id, label, center, width }) => ({
          id,
          label,
          density: bell({ center, width, from: -0.4, to: 1.2, count: 33 }),
          median: center,
          q1: center - width * 0.67,
          q3: center + width * 0.67,
        })),
        value: { label: 'Episode reward', domain: [-0.4, 1.2], format: formats.decimal },
        densityLabel: 'estimated density',
        transforms: ['Kernel density, bandwidth 0.05'],
      },
    },
  },
  StripPlot: {
    question: 'Where does every single value of each group fall?',
    use: 'Use it when there are few enough values to show each one, such as the score of every seed.',
    avoid: 'Use BoxPlot or ViolinPlot when there are hundreds of values per group.',
    example: {
      chart: 'StripPlot',
      props: {
        title: 'Score per seed',
        description: 'Synthetic scores of eight seeds per configuration; the rule marks the median.',
        locale: 'en-US',
        groups: [
          { id: 'a', label: 'Config A' },
          { id: 'b', label: 'Config B' },
          { id: 'c', label: 'Config C' },
        ],
        points: ['a', 'b', 'c'].flatMap((groupId, group) =>
          range({ count: 8 }).map((seed) => ({
            id: `${groupId}-${seed}`,
            groupId,
            label: `Seed ${seed}`,
            value: share(0.6 + group * 0.05 + Math.sin(seed * 2.3 + group) * 0.03),
          })),
        ),
        summary: { a: 0.6, b: 0.65, c: 0.7 },
        summaryLabel: 'Median',
        value: { label: 'Score', domain: [0.5, 0.8], format: formats.percent },
      },
    },
  },
  Ridgeline: {
    question: 'How does a distribution shift across many ordered groups?',
    use: 'Use it for prepared densities of many groups in order, such as activation values per layer.',
    avoid: 'Use ViolinPlot for a few unordered groups, and Histogram for one distribution.',
    example: {
      chart: 'Ridgeline',
      props: {
        title: 'Activation norm by layer',
        description: 'Synthetic kernel densities for six layers.',
        locale: 'en-US',
        rows: range({ count: 6 }).map((layer) => ({
          id: `layer-${layer * 4}`,
          label: `Layer ${layer * 4}`,
          density: bell({ center: 2 + layer * 0.9, width: 0.6 + layer * 0.12, from: 0, to: 10, count: 41 }),
        })),
        value: { label: 'Activation norm', domain: [0, 10], format: formats.decimal },
        densityLabel: 'estimated density',
      },
    },
  },
  Matrix: {
    question: 'What is the value for every pair of two categories?',
    use: 'Use it for a measured value per row and column, such as accuracy per model and benchmark, with missing cells marked.',
    avoid:
      'Use ConfusionMatrix, CorrelationMatrix or AttentionMatrix for those specific matrices, and DotPlot for few rows.',
    example: {
      chart: 'Matrix',
      props: {
        title: 'Accuracy by model and benchmark',
        description: 'Synthetic. One run was not evaluated.',
        locale: 'en-US',
        rows: ['Small', 'Medium', 'Large'].map((label) => ({ id: label.toLowerCase(), label })),
        columns: benchmarks,
        cells: ['small', 'medium', 'large'].flatMap((rowId, row) =>
          benchmarks.map((column, index) =>
            rowId === 'medium' && column.id === 'truthfulqa'
              ? { id: `${rowId}-${column.id}`, rowId, columnId: column.id, kind: 'missing', reason: 'Not evaluated' }
              : {
                  id: `${rowId}-${column.id}`,
                  rowId,
                  columnId: column.id,
                  kind: 'value',
                  value: share(0.45 + row * 0.1 + index * 0.04),
                },
          ),
        ),
        valueLabel: 'Accuracy',
        valueFormat: formats.percent,
        domain: [0, 1],
        palette: 'sequential',
      },
    },
  },
  TokenHeatmap: {
    question: 'Which tokens of a text carry the most of a score?',
    use: 'Use it to shade a passage by a per-token value, such as a feature’s activation or a token’s loss.',
    avoid: 'Use TokenExamples for several passages, and TokenPredictions for the next-token distribution.',
    example: {
      chart: 'TokenHeatmap',
      props: {
        title: 'Per-token loss',
        description: 'Synthetic loss of each token given the ones before it.',
        locale: 'en-US',
        tokens: sentenceTokens.map((token, index) => ({
          ...token,
          score: [3.1, 4.2, 2.8, 0.9, 0.4, 1.7, 3.6, 1.2, 0.6, 2.4][index] ?? null,
        })),
        valueLabel: 'Loss (nats)',
        valueFormat: formats.decimal,
        domain: [0, 5],
        palette: 'sequential',
      },
    },
  },
  ConfusionMatrix: {
    question: 'Which classes does a classifier confuse with which?',
    use: 'Use it for counts of true against predicted classes, raw or normalized per true class.',
    avoid: 'Use Matrix for any other value per pair, and BarChart for per-class accuracy alone.',
    example: {
      chart: 'ConfusionMatrix',
      props: {
        title: 'Toxicity classifier',
        description: 'Synthetic counts on 1,000 held-out items, shown as a share of each true class.',
        locale: 'en-US',
        classes: [
          { id: 'safe', label: 'Safe' },
          { id: 'borderline', label: 'Borderline' },
          { id: 'toxic', label: 'Toxic' },
        ],
        counts: [
          [610, 42, 8],
          [55, 118, 27],
          [6, 21, 113],
        ],
        normalize: 'row',
      },
    },
  },
  CorrelationMatrix: {
    question: 'Which measures move together?',
    use: 'Use it for prepared correlation coefficients between a few measures, such as benchmark scores across models.',
    avoid: 'Use ScatterMatrix to see the points behind each coefficient.',
    example: {
      chart: 'CorrelationMatrix',
      props: {
        title: 'Benchmark correlation across 40 models',
        description: 'Synthetic Pearson coefficients.',
        locale: 'en-US',
        variables: benchmarks,
        coefficients: [
          [1, 0.82, 0.64, 0.77, 0.31],
          [0.82, 1, 0.58, 0.69, 0.22],
          [0.64, 0.58, 1, 0.51, 0.12],
          [0.77, 0.69, 0.51, 1, 0.35],
          [0.31, 0.22, 0.12, 0.35, 1],
        ],
        triangle: 'lower',
        transforms: ['Pearson correlation of scores'],
      },
    },
  },
  AttentionMatrix: {
    question: 'Which earlier tokens does each token attend to?',
    use: 'Use it for one head’s attention weights over a short sequence, with the causal mask shown.',
    avoid: 'Use TokenLinks to read the strongest links as lines between two rows of the text.',
    example: {
      chart: 'AttentionMatrix',
      props: {
        title: 'Layer 5, head 3 attention',
        description: 'Synthetic weights of a previous-token head.',
        locale: 'en-US',
        sources: sentenceTokens.slice(0, 7),
        destinations: sentenceTokens.slice(0, 7),
        weights: range({ count: 7 }).map((row) =>
          range({ count: 7 }).map((column) => {
            if (column > row) {
              return null;
            }

            return row === 0 ? 1 : share(column === row - 1 ? 0.7 : 0.3 / row);
          }),
        ),
        mask: 'causal',
      },
    },
  },
  CalendarHeatmap: {
    question: 'How does a daily measure vary by week and weekday?',
    use: 'Use it for one value per day over weeks or months, such as daily evaluation runs or incidents.',
    avoid: 'Use LineChart when the trend matters more than the weekly pattern.',
    example: {
      chart: 'CalendarHeatmap',
      props: {
        title: 'Evaluation runs per day',
        description: 'Synthetic: fewer runs at weekends.',
        locale: 'en-US',
        days: days({ start: Date.UTC(2026, 8, 7), step: time.day, count: 70 }).map((date, index) => ({
          date,
          value: index % 7 >= 5 ? 2 + (index % 3) : 9 + Math.round(4 * Math.sin(index / 5)),
        })),
        range: { from: '2026-09-07', to: '2026-11-15' },
        weekStartsOn: 'monday',
        valueLabel: 'Runs',
        valueFormat: formats.integer,
      },
    },
  },
  RelationGraph: {
    question: 'How are a few named things connected?',
    use: 'Use it for a small graph whose positions the application lays out, such as services and their calls.',
    avoid: 'Use FlowDiagram when links carry amounts, and TreeDiagram for a strict hierarchy.',
    example: {
      chart: 'RelationGraph',
      props: {
        title: 'Service dependencies',
        description: 'Synthetic. Arrows point from caller to callee.',
        locale: 'en-US',
        width: 464,
        height: 240,
        nodes: [
          { id: 'gateway', label: 'Gateway', x: 8, y: 96, width: 120, height: 48 },
          { id: 'router', label: 'Router', x: 172, y: 96, width: 120, height: 48 },
          { id: 'cache', label: 'Prompt cache', x: 172, y: 8, width: 120, height: 48 },
          { id: 'model', label: 'Model server', x: 336, y: 52, width: 120, height: 48 },
          { id: 'billing', label: 'Billing', x: 336, y: 160, width: 120, height: 48 },
        ],
        edges: [
          { id: 'e1', sourceId: 'gateway', targetId: 'router', label: 'routes', direction: 'directed' },
          { id: 'e2', sourceId: 'router', targetId: 'cache', label: 'looks up', direction: 'directed' },
          { id: 'e3', sourceId: 'router', targetId: 'model', label: 'calls', direction: 'directed' },
          { id: 'e4', sourceId: 'router', targetId: 'billing', label: 'records', direction: 'directed' },
        ],
      },
    },
  },
  FlowDiagram: {
    question: 'Where does a quantity go between stages?',
    use: 'Use it for amounts flowing between stages, such as requests from source through filter to outcome.',
    avoid: 'Use BridgeChart for changes to one total, and RelationGraph when links carry no amount.',
    example: {
      chart: 'FlowDiagram',
      props: {
        title: 'Requests through the safety pipeline',
        description: 'Synthetic counts for one day.',
        locale: 'en-US',
        nodes: [
          { id: 'api', label: 'API' },
          { id: 'app', label: 'App' },
          { id: 'filter', label: 'Safety filter' },
          { id: 'served', label: 'Served', tone: 'positive' },
          { id: 'blocked', label: 'Blocked', tone: 'negative' },
        ],
        links: [
          { id: 'api-filter', sourceId: 'api', targetId: 'filter', value: 62_000 },
          { id: 'app-filter', sourceId: 'app', targetId: 'filter', value: 38_000 },
          { id: 'filter-served', sourceId: 'filter', targetId: 'served', value: 97_400 },
          { id: 'filter-blocked', sourceId: 'filter', targetId: 'blocked', value: 2600 },
        ],
        valueFormat: formats.integer,
      },
    },
  },
  AttributionGraph: {
    question: 'Which features carry a model’s answer from the prompt to the output?',
    use: 'Use it for an attribution graph: tokens, features by layer and the output, with signed edge weights.',
    avoid: 'Use FlowDiagram for amounts that are conserved between stages, and TokenLinks for token-to-token weights.',
    example: {
      chart: 'AttributionGraph',
      props: {
        title: 'Attribution for “The capital of France is” → “Paris”',
        description: 'Synthetic graph. Edge weight is the direct effect on the target.',
        locale: 'en-US',
        layers: [
          { id: 'tokens', label: 'Prompt' },
          { id: 'l4', label: 'Layer 4' },
          { id: 'l12', label: 'Layer 12' },
          { id: 'out', label: 'Output' },
        ],
        nodes: [
          { id: 'tok-france', layerId: 'tokens', label: 'France', kind: 'token' },
          { id: 'tok-capital', layerId: 'tokens', label: 'capital', kind: 'token' },
          { id: 'f-country', layerId: 'l4', label: 'Country names', kind: 'feature' },
          { id: 'f-capital', layerId: 'l4', label: 'Capital-of relation', kind: 'feature' },
          { id: 'f-paris', layerId: 'l12', label: 'Say “Paris”', kind: 'feature' },
          { id: 'err', layerId: 'l12', label: 'Error', kind: 'error' },
          { id: 'paris', layerId: 'out', label: 'Paris', kind: 'output', value: 0.91 },
        ],
        edges: [
          { id: 'a', sourceId: 'tok-france', targetId: 'f-country', weight: 0.8 },
          { id: 'b', sourceId: 'tok-capital', targetId: 'f-capital', weight: 0.7 },
          { id: 'c', sourceId: 'f-country', targetId: 'f-paris', weight: 0.6 },
          { id: 'd', sourceId: 'f-capital', targetId: 'f-paris', weight: 0.5 },
          { id: 'e', sourceId: 'f-paris', targetId: 'paris', weight: 0.9 },
          { id: 'f', sourceId: 'err', targetId: 'paris', weight: -0.1 },
        ],
        weightLabel: 'Direct effect',
        weightFormat: formats.decimal,
        valueLabel: 'Probability',
        valueFormat: formats.percent,
      },
    },
  },
  TreeDiagram: {
    question: 'How is a hierarchy structured?',
    use: 'Use it to show parent and child relations, such as a run’s spans or an agent’s plan, when the structure is the point.',
    avoid: 'Use Treemap or Icicle when each node carries an amount readers should compare.',
    example: {
      chart: 'TreeDiagram',
      props: {
        title: 'Agent plan',
        description: 'Synthetic task decomposition with step durations.',
        locale: 'en-US',
        nodes: [
          { id: 'task', parentId: null, label: 'Fix the failing test', value: 412 },
          { id: 'read', parentId: 'task', label: 'Read the test', value: 38 },
          { id: 'search', parentId: 'task', label: 'Search the code', value: 96 },
          { id: 'edit', parentId: 'task', label: 'Edit the parser', value: 181 },
          { id: 'run', parentId: 'task', label: 'Run the tests', value: 97 },
          { id: 'grep', parentId: 'search', label: 'Grep for the symbol', value: 41 },
          { id: 'open', parentId: 'search', label: 'Open two files', value: 55 },
        ],
        valueLabel: 'Duration (s)',
        valueFormat: formats.integer,
      },
    },
  },
  Treemap: {
    question: 'Which parts make up most of a total?',
    use: 'Use it for many parts of one total where the large parts matter, such as spend by project.',
    avoid: 'Use BreakdownBar for a few parts, Icicle for nested levels and RankedBars to compare parts exactly.',
    example: {
      chart: 'Treemap',
      props: {
        title: 'GPU hours by project',
        description: 'Synthetic November usage.',
        locale: 'en-US',
        items: [
          { id: 'pretrain', label: 'Pretraining', value: 18_400 },
          { id: 'rl', label: 'RL fine-tuning', value: 7200 },
          { id: 'evals', label: 'Evaluations', value: 3100 },
          { id: 'interp', label: 'Interpretability', value: 2400 },
          { id: 'serving', label: 'Serving tests', value: 1500 },
          { id: 'misc', label: 'Other', value: 600 },
        ],
        valueFormat: formats.integer,
      },
    },
  },
  Icicle: {
    question: 'How does a total split through nested levels?',
    use: 'Use it for a hierarchy whose nodes carry amounts, such as time spent per span of a trace.',
    avoid: 'Use Treemap for one level of many parts, and TreeDiagram when there are no amounts.',
    example: {
      chart: 'Icicle',
      props: {
        title: 'Time per span of one request',
        description: 'Synthetic trace.',
        locale: 'en-US',
        nodes: [
          { id: 'request', parentId: null, label: 'Request', value: 840 },
          { id: 'auth', parentId: 'request', label: 'Auth', value: 40 },
          { id: 'generate', parentId: 'request', label: 'Generate', value: 720 },
          { id: 'log', parentId: 'request', label: 'Log', value: 60 },
          { id: 'prefill', parentId: 'generate', label: 'Prefill', value: 260 },
          { id: 'decode', parentId: 'generate', label: 'Decode', value: 440 },
        ],
        valueFormat: formats.milliseconds,
      },
    },
  },
  Waterfall: {
    question: 'When did each step of a request or run start and end?',
    use: 'Use it for the recorded timing of many steps on one scale, with exact timing stated for each row.',
    avoid: 'Use EventStrip for events in a few lanes over a long window, and BreakdownBar for totals per step.',
    example: {
      chart: 'Waterfall',
      props: {
        title: 'Steps of one agent turn',
        locale: 'en-US',
        start: 0,
        end: 2400,
        rowLabel: 'Step',
        summaryLabel: 'Duration',
        offsetFormat: formats.milliseconds,
        items: [
          {
            id: 'plan',
            label: 'Plan',
            detail: 'Model call',
            summary: '420 ms',
            geometry: { kind: 'interval', start: 0, end: 420 },
          },
          {
            id: 'search',
            label: 'Search tool',
            detail: 'Tool call',
            summary: '610 ms',
            geometry: { kind: 'interval', start: 430, end: 1040 },
          },
          {
            id: 'read',
            label: 'Read file',
            detail: 'Tool call',
            summary: '180 ms',
            geometry: { kind: 'interval', start: 450, end: 630 },
          },
          {
            id: 'answer',
            label: 'Answer',
            detail: 'Model call',
            summary: '1,150 ms',
            tone: 'positive',
            geometry: { kind: 'interval', start: 1100, end: 2250 },
          },
          {
            id: 'feedback',
            label: 'Feedback recorded',
            detail: 'One instant',
            summary: 'At 2,300 ms',
            geometry: { kind: 'point', at: 2300, marker: 'filled' },
          },
        ],
      },
    },
  },
  EventStrip: {
    question: 'What happened when, across a few kinds of events?',
    use: 'Use it for deploys, incidents, runs and alerts over hours or days, where overlaps between lanes matter.',
    avoid: 'Use Waterfall for the steps of one request, and LineChart for a measured value over time.',
    example: {
      chart: 'EventStrip',
      props: {
        title: 'Production on 16 November',
        description: 'Synthetic operations log.',
        locale: 'en-US',
        lanes: [
          { id: 'deploys', label: 'Deploys' },
          { id: 'incidents', label: 'Incidents', tone: 'negative' },
          { id: 'evals', label: 'Evaluation runs' },
        ],
        events: [
          { id: 'd1', laneId: 'deploys', label: 'api 4.12.0', start: time.start + 2 * time.hour },
          { id: 'd2', laneId: 'deploys', label: 'api 4.12.1', start: time.start + 10 * time.hour },
          {
            id: 'i1',
            laneId: 'incidents',
            label: 'Elevated 5xx',
            start: time.start + 8 * time.hour,
            end: time.start + 10 * time.hour,
          },
          {
            id: 'e1',
            laneId: 'evals',
            label: 'Nightly suite',
            start: time.start + time.hour,
            end: time.start + 6 * time.hour,
          },
          {
            id: 'e2',
            laneId: 'evals',
            label: 'Safety sweep',
            start: time.start + 4 * time.hour,
            end: time.start + 9 * time.hour,
          },
          {
            id: 'e3',
            laneId: 'evals',
            label: 'Long-context eval',
            start: time.start + 13 * time.hour,
            end: time.start + 21 * time.hour,
          },
        ],
        domain: [time.start, time.start + time.day],
        markers: [{ id: 'cut', label: 'Release cut', at: time.start + 16 * time.hour }],
        timeFormat: time.clock,
      },
    },
  },
  ContourPlot: {
    question: 'What does a value look like over two continuous inputs?',
    use: 'Use it for a prepared grid over two inputs, such as loss over two hyperparameters, with an optimizer’s path.',
    avoid: 'Use DensityMap for counts of points, and Matrix for a value per pair of categories.',
    example: {
      chart: 'ContourPlot',
      props: {
        title: 'Loss over learning rate and warmup',
        description: 'Synthetic loss surface. The dot marks the best trial.',
        locale: 'en-US',
        grid: {
          columns: 24,
          rows: 18,
          xDomain: [-5, -2],
          yDomain: [0, 4000],
          values: peaks({
            columns: 24,
            rows: 18,
            peaks: [
              { x: 4, y: 3, width: 6, height: 1.2 },
              { x: 20, y: 15, width: 7, height: 1.6 },
              { x: 13, y: 9, width: 3, height: -0.8 },
            ],
          }).map((value) => Math.round((2.4 + value) * 1000) / 1000),
        },
        levels: [1.8, 2, 2.2, 2.4, 2.6, 2.8, 3],
        x: { label: 'log10 learning rate', format: formats.decimal },
        y: { label: 'Warmup steps', format: formats.integer },
        value: { label: 'Loss (nats)', format: formats.decimal },
        markers: [{ id: 'best', label: 'Best trial', x: -3.4, y: 2000 }],
      },
    },
  },
  ScatterMatrix: {
    question: 'How do several measures relate to each other, pair by pair?',
    use: 'Use it for up to six measures of a few hundred records, such as cost, latency and accuracy per model.',
    avoid:
      'Use ScatterPlot for one pair, ParallelCoordinates for many measures, and CorrelationMatrix for coefficients alone.',
    example: {
      chart: 'ScatterMatrix',
      props: {
        title: 'Model measures',
        description: 'Synthetic: 30 models in two families.',
        locale: 'en-US',
        dimensions: [
          { id: 'params', label: 'Parameters (B)', format: formats.integer, scale: 'log' },
          { id: 'latency', label: 'Latency (ms)', format: formats.integer },
          { id: 'accuracy', label: 'Accuracy', format: formats.percent },
        ],
        groups: [
          { id: 'dense', label: 'Dense' },
          { id: 'moe', label: 'Mixture of experts' },
        ],
        rows: range({ count: 30 }).map((index) => {
          const params = 2 ** (1 + (index % 15) * 0.5);

          return {
            id: `m${index}`,
            label: `Model ${index + 1}`,
            group: index < 15 ? 'dense' : 'moe',
            values: {
              params: Math.round(params),
              latency: Math.round((index < 15 ? 40 : 25) + params * (index < 15 ? 2.2 : 0.9)),
              accuracy: share(0.4 + Math.log2(params) * 0.05 + (index % 4) * 0.01),
            },
          };
        }),
      },
    },
  },
  ParallelCoordinates: {
    question: 'Which records do well on many measures at once?',
    use: 'Use it to filter records across many measures, such as hyperparameter trials by their settings and score.',
    avoid: 'Use ScatterMatrix to see pairwise relations, and a table for exact values.',
    example: {
      chart: 'ParallelCoordinates',
      props: {
        title: 'Hyperparameter trials',
        description: 'Synthetic: 24 trials of a tuning run.',
        locale: 'en-US',
        dimensions: [
          {
            id: 'lr',
            label: 'Learning rate',
            format: { maximumSignificantDigits: 2 },
            scale: 'log',
            domain: [0.00001, 0.01],
          },
          { id: 'batch', label: 'Batch size', format: formats.integer, domain: [0, 1024] },
          { id: 'dropout', label: 'Dropout', format: formats.decimal, domain: [0, 0.5] },
          { id: 'score', label: 'Validation score', format: formats.percent, domain: [0.5, 0.9] },
        ],
        rows: range({ count: 24 }).map((index) => ({
          id: `trial-${index}`,
          label: `Trial ${index + 1}`,
          values: {
            lr: 10 ** (-5 + (index % 6) * 0.55),
            batch: 64 * (1 + (index % 8)),
            dropout: share(((index * 7) % 10) * 0.05),
            score: share(0.62 + 0.2 * Math.exp(-(((index % 6) - 3) ** 2) / 3) - ((index * 7) % 10) * 0.006),
          },
        })),
      },
    },
  },
  EmbeddingMap: {
    question: 'How do many items cluster in a learned embedding space?',
    use: 'Use it for thousands to a million projected points with groups and landmarks, drawn on canvas or WebGL.',
    avoid: 'Use ScatterPlot when every point needs to be inspected by name, and DensityMap when only density matters.',
    example: {
      chart: 'EmbeddingMap',
      props: {
        title: 'Prompt embeddings',
        description: 'Synthetic two-dimensional projection of 600 prompts in three topics.',
        locale: 'en-US',
        points: {
          x: range({ count: 600 }).map((index) =>
            round(((index % 3) - 1) * 4 + Math.cos(index * 2.4) * 2.2 * Math.sqrt(((index * 37) % 600) / 600)),
          ),
          y: range({ count: 600 }).map((index) =>
            round((index % 3 === 1 ? 3 : -1) + Math.sin(index * 2.4) * 2.2 * Math.sqrt(((index * 37) % 600) / 600)),
          ),
          group: range({ count: 600 }).map((index) => index % 3),
        },
        groups: [
          { id: 'code', label: 'Code' },
          { id: 'math', label: 'Math' },
          { id: 'chat', label: 'Chat' },
        ],
        landmarks: [{ id: 'reference', label: 'Reference prompt', x: 0, y: -4 }],
        x: { label: 'Component 1', domain: [-8, 8], format: formats.decimal },
        y: { label: 'Component 2', domain: [-5, 7], format: formats.decimal },
        transforms: ['Projected with UMAP'],
      },
    },
  },
  DensityMap: {
    question: 'Where are points concentrated over two measures?',
    use: 'Use it for prepared two-dimensional counts of very many points, such as prompt length against latency.',
    avoid: 'Use ScatterPlot when there are few enough points to show each, and ContourPlot for a measured surface.',
    example: {
      chart: 'DensityMap',
      props: {
        title: 'Prompt length and latency',
        description: 'Synthetic counts of 200,000 requests.',
        locale: 'en-US',
        histogram: {
          columns: 32,
          rows: 20,
          xDomain: [0, 8000],
          yDomain: [0, 2000],
          counts: peaks({
            columns: 32,
            rows: 20,
            peaks: [
              { x: 5, y: 15, width: 3, height: 900 },
              { x: 18, y: 8, width: 5, height: 300 },
            ],
          }).map((value) => Math.round(value)),
        },
        x: { label: 'Prompt length (tokens)', format: formats.integer },
        y: { label: 'Latency (ms)', format: formats.integer },
        count: { label: 'Requests', format: formats.integer },
        transforms: ['Binned into 32 × 20 cells'],
      },
    },
  },
  TokenExamples: {
    question: 'On which passages, and which tokens, does a feature fire?',
    use: 'Use it for the top activating examples of a feature, each passage shaded by activation around its peak.',
    avoid: 'Use TokenHeatmap for one passage, and TokenGrid to compare several values per token.',
    example: {
      chart: 'TokenExamples',
      props: {
        title: 'Feature 2,817: references to warmth',
        description: 'Synthetic top activating examples.',
        locale: 'en-US',
        examples: [
          {
            id: 'ex1',
            label: 'Top 1',
            tokens: sentence.map((text, index) => ({ text, value: index === 9 ? 8.4 : index === 8 ? 1.1 : 0 })),
            peakIndex: 9,
          },
          {
            id: 'ex2',
            label: 'Top 2',
            tokens: [' A', ' cozy', ' fire', ' kept', ' the', ' room', ' toasty'].map((text, index) => ({
              text,
              value: [0, 3.2, 2.6, 0, 0, 0.4, 7.9][index] ?? 0,
            })),
            peakIndex: 6,
          },
        ],
        valueLabel: 'Activation',
        valueFormat: formats.decimal,
        domain: [0, 9],
        palette: 'sequential',
      },
    },
  },
  TokenPredictions: {
    question: 'Which tokens does the model expect next, and how did that change?',
    use: 'Use it for the top next-token probabilities at one position, against a baseline such as before an intervention.',
    avoid: 'Use RankedBars for ranked values that are not token probabilities.',
    example: {
      chart: 'TokenPredictions',
      props: {
        title: 'Next token after “The capital of France is”',
        description: 'Synthetic probabilities with and without ablating feature 2,817.',
        locale: 'en-US',
        predictions: [
          { id: 'paris', token: ' Paris', probability: 0.91, baseline: 0.42, isTarget: true },
          { id: 'lyon', token: ' Lyon', probability: 0.03, baseline: 0.18 },
          { id: 'a', token: ' a', probability: 0.02, baseline: 0.11 },
          { id: 'the', token: ' the', probability: 0.01, baseline: 0.09 },
        ],
        valueLabel: 'Probability',
        valueFormat: formats.percent,
        baselineLabel: 'Feature ablated',
      },
    },
  },
  TokenGrid: {
    question: 'How does a per-token value change across layers or conditions?',
    use: 'Use it for one value per token and row, such as a logit-lens probability per layer.',
    avoid: 'Use TokenHeatmap for a single row, and Matrix when the columns are not tokens.',
    example: {
      chart: 'TokenGrid',
      props: {
        title: 'Logit lens: probability of the next token',
        description: 'Synthetic. Each row reads the residual stream at one layer.',
        locale: 'en-US',
        columns: sentenceTokens.slice(0, 6).map(({ id, text }) => ({ id, token: text })),
        rows: [0, 4, 8, 12].map((layer) => ({ id: `l${layer}`, label: `Layer ${layer}` })),
        cells: [0, 4, 8, 12].flatMap((layer, row) =>
          sentenceTokens
            .slice(0, 6)
            .map(({ id }, column) => ({
              rowId: `l${layer}`,
              columnId: id,
              token: sentence[column + 1] ?? null,
              value: share(Math.min(1, 0.05 + row * 0.22 + (column % 3) * 0.05)),
            })),
        ),
        valueLabel: 'Probability',
        valueFormat: formats.percent,
        domain: [0, 1],
        palette: 'sequential',
      },
    },
  },
  TokenLinks: {
    question: 'Which tokens most influence which later tokens?',
    use: 'Use it for the strongest token-to-token weights, such as attention or attribution, drawn as lines between two rows of the text.',
    avoid: 'Use AttentionMatrix to see every weight of a head.',
    example: {
      chart: 'TokenLinks',
      props: {
        title: 'Strongest attention links, layer 5',
        description: 'Synthetic weights above 0.2.',
        locale: 'en-US',
        tokens: sentenceTokens.map(({ id, text }) => ({ id, text })),
        links: [
          { sourceId: 't1', destinationId: 't7', weight: 0.72 },
          { sourceId: 't5', destinationId: 't9', weight: 0.41 },
          { sourceId: 't2', destinationId: 't3', weight: 0.33 },
          { sourceId: 't0', destinationId: 't4', weight: 0.24 },
        ],
        weightLabel: 'Attention weight',
        valueFormat: formats.decimal,
        domain: [0, 1],
        direction: 'source-to-destination',
      },
    },
  },
  ImageGrid: {
    question: 'What do a set of images look like, with a value for each?',
    use: 'Use it for a gallery of inputs or samples with a score each, such as a classifier’s most confident errors.',
    avoid: 'Use ImageAtlas when the images sit at positions in a two-dimensional layout.',
    example: {
      chart: 'ImageGrid',
      props: {
        title: 'Most confident errors',
        description: 'Synthetic pictures with the wrong class’s probability.',
        locale: 'en-US',
        items: range({ count: 8 }).map((index) => ({
          id: `img-${index}`,
          src: tile(index),
          alt: `Synthetic picture ${index + 1}: a white disc on a two-tone background`,
          label: `Sample ${index + 1}`,
          value: share(0.98 - index * 0.04),
        })),
        valueLabel: 'Wrong-class probability',
        valueFormat: formats.percent,
        columns: 4,
      },
    },
  },
  AttributionOverlay: {
    question: 'Which parts of an image drove the model’s output?',
    use: 'Use it for a saliency or attribution grid laid over one image, with an adjustable opacity.',
    avoid: 'Use ImageGrid to compare many images.',
    example: {
      chart: 'AttributionOverlay',
      props: {
        title: 'Attribution for the class “disc”',
        description: 'Synthetic integrated gradients on a 12 × 12 grid.',
        locale: 'en-US',
        image: { src: tile(2), alt: 'Synthetic picture: a white disc on a two-tone background', width: 96, height: 96 },
        grid: {
          columns: 12,
          rows: 12,
          values: peaks({ columns: 12, rows: 12, peaks: [{ x: 5.5, y: 5.5, width: 2.2, height: 1 }] }),
        },
        valueLabel: 'Attribution',
        valueFormat: formats.decimal,
        domain: [0, 1],
        palette: 'sequential',
      },
    },
  },
  ImageAtlas: {
    question: 'How do images arrange over a two-dimensional layout?',
    use: 'Use it for images placed on a grid by a projection or two factors, such as a feature visualization atlas.',
    avoid: 'Use ImageGrid for a plain gallery, and EmbeddingMap for many points without pictures.',
    example: {
      chart: 'ImageAtlas',
      props: {
        title: 'Activation atlas, layer 6',
        description: 'Synthetic: average input per cell of a 4 × 3 layout.',
        locale: 'en-US',
        columns: 4,
        rows: 3,
        cells: range({ count: 12 }).map((index) => ({
          id: `cell-${index}`,
          column: index % 4,
          row: Math.floor(index / 4),
          src: tile(index),
          alt: `Synthetic picture for cell ${index + 1}`,
          value: share(0.3 + (index % 5) * 0.12),
        })),
        xLabel: 'Component 1',
        yLabel: 'Component 2',
        valueLabel: 'Mean activation',
        valueFormat: formats.decimal,
      },
    },
  },
};

/**
 * One entry per registered chart: the question it answers, when to use it, when another chart is better, and a small
 * valid spec to start from. An agent can read it to choose a chart; the figure wall draws every example.
 */
export const chartGuide: ReadonlyArray<ChartGuideEntry> = Object.values(book).map((entry) => ({
  ...entry,
  chart: entry.example.chart,
  family: figureRegistry[entry.example.chart].family,
}));

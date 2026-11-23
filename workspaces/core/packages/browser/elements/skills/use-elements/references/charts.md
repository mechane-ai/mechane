# Charts

Import shared props, formats, tone scope and linking from `@mechane-ai/elements/charts`, and each chart from its family
entry. The application queries, aggregates, ranks, samples and computes statistics. A chart draws supplied values and
lets a reader inspect them. To describe a figure as JSON, read [figures](figures.md). For ready-made domain pages, read
[kits](kits.md).

## How every chart works

- One kernel draws all of them, so axes, ticks, marks, readout and keyboard cursor behave alike.
- Every chart takes the same figure props: `title`, `description`, `locale`, `source`, `coverage`, `transforms`,
  `status`, `emptyLabel`, `report` and `actions`.
- A number or an instant is written from a declared format and the figure's `locale`. A format is data, not a function.
- Each visual channel has one meaning: hue names a thing, lightness is a magnitude, two hues around a neutral middle are
  a signed value, a dashed stroke is modelled, a pale band is uncertainty, a hollow mark is missing, gray is context.
- Every figure has the same states: loading, empty, invalid, partial and ready.

## Choose the chart

Pick by the question. The tables are the library's `chartGuide`, written out: one entry per registered chart, 50 in all,
grouped by family. `chartGuide` is exported from `@mechane-ai/elements/charts/figure`, so you can read the same guidance
at run time. Each entry has `chart`, `family`, `question`, `use`, `avoid` and `example`, a small valid figure spec to
start from.

```ts
import { chartGuide } from '@mechane-ai/elements/charts/figure';

const entry = chartGuide.find((item) => item.chart === 'DotPlot');
```

`ColorLegend` (`/charts/matrix`), the table cells (`/charts/cells`: `BarCell`, `HeatCell`, `ChangeCell`, `IntervalCell`
and `SparkCell`), the placeholders and the kits are not registered charts, so the guide does not list them. Use a bar,
heat, change, interval or spark cell for a graphic inside a table column. Use a table when exact comparison matters more
than shape.

### `trend`

Import from `@mechane-ai/elements/charts/trend`.

| Chart          | Shows                                                                    | Use it when                                                                                                                      | Another chart is better when                                                                                                     |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `CurveChart`   | How did a metric change over training steps or another ordered variable? | Use it for loss, accuracy or any measure over steps, layers or doses, on linear or log axes, with bands for spread across seeds. | Use LineChart when the ordered variable is a timestamp, and RunsChart when there are dozens of runs to show as context.          |
| `RunsChart`    | How does one run compare with the whole sweep it belongs to?             | Use it for many training runs at once: every run stays gray context and only the runs you name are drawn in color.               | Use CurveChart for a handful of series that each deserve a color and a legend entry.                                             |
| `SlopeChart`   | How did each item move between two to six conditions?                    | Use it to compare before and after, or a few checkpoints, where the direction of each change matters more than the path.         | Use DumbbellPlot when there are many rows and exactly two conditions, and CurveChart when the conditions are many ordered steps. |
| `BumpChart`    | How did the ranking of items change across stages?                       | Use it when the order matters more than the values: a leaderboard over releases, or model rank per evaluation round.             | Use SlopeChart or CurveChart when the size of the gaps between items matters.                                                    |
| `HorizonChart` | Which of many series run above or below normal, and when?                | Use it for dozens of aligned series in little height, such as the error rate of every service over a day.                        | Use LineChart or SmallMultiples when there are only a few series and readers need exact levels.                                  |

### `comparison`

Import from `@mechane-ai/elements/charts/comparison`.

| Chart          | Shows                                                    | Use it when                                                                                                         | Another chart is better when                                                                                     |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DotPlot`      | How do a few models compare on each of several measures? | Use it to compare values across categories without bars, when the axis need not start at zero and intervals matter. | Use BarChart when the amount itself, measured from zero, is the point.                                           |
| `DumbbellPlot` | How much did each row change between two measurements?   | Use it for many rows with exactly two values each, such as scores before and after fine-tuning.                     | Use SlopeChart for few rows or more than two conditions, and BridgeChart for how parts add up to a total change. |
| `BulletBar`    | Is each measure meeting its target?                      | Use it for a few key measures held against targets and qualitative bands, such as latency against its objective.    | Use BarChart when there are no targets, and a table when readers need many exact values.                         |

### `cartesian`

Import from `@mechane-ai/elements/charts/cartesian`.

| Chart            | Shows                                                             | Use it when                                                                                                | Another chart is better when                                                                               |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BarChart`       | How large is each amount, by category and series?                 | Use it for amounts measured from zero across a few categories, grouped or stacked by series.               | Use DotPlot when the values do not start at zero, and LineChart when the categories are instants.          |
| `BridgeChart`    | Which changes add up to the difference between two totals?        | Use it to explain a change from one total to another as a sequence of signed parts, such as cost by cause. | Use BarChart when the parts are independent amounts, not steps from one total to the next.                 |
| `BreakdownBar`   | How does one total split into parts?                              | Use it for a single total and a few named parts, such as where the time of a request went.                 | Use Treemap for many parts, and BarChart to compare several totals.                                        |
| `ScatterPlot`    | How do two measures of the same records relate?                   | Use it for up to a thousand records with two measures each, such as cost and accuracy per model.           | Use EmbeddingMap or DensityMap for many thousands of points, and ScatterMatrix for more than two measures. |
| `LineChart`      | How did a measure change over time?                               | Use it for a few series over timestamps, such as latency per minute or requests per hour.                  | Use CurveChart when the ordered variable is not time, and HorizonChart for dozens of series.               |
| `AreaChart`      | How did a total and its parts change over time?                   | Use it stacked for parts that add up to a meaningful total over time, such as requests by region.          | Use LineChart when the series do not add up, or when readers compare series that are not at the bottom.    |
| `SmallMultiples` | How do several related measures move together over the same time? | Use it for a few measures with different units on one shared time axis, inspected together.                | Use LineChart when the series share one unit and belong on one plot.                                       |
| `Sparkline`      | Which way is one measure trending, at a glance?                   | Use it inline beside a number or in a dense summary, where a full chart would be too much.                 | Use LineChart when readers need axes, exact values or several series.                                      |

### `distribution`

Import from `@mechane-ai/elements/charts/distribution`.

| Chart          | Shows                                                       | Use it when                                                                                                    | Another chart is better when                                                                         |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Histogram`    | How are the values of one measure distributed?              | Use it for the shape of one distribution from prepared bins, such as response lengths or latencies.            | Use ECDF to read percentiles exactly, and BoxPlot or ViolinPlot to compare several groups.           |
| `ECDF`         | What share of values falls below a given level?             | Use it to read percentiles and compare tails exactly, such as the share of requests under a latency objective. | Use Histogram when the shape of the distribution matters more than its percentiles.                  |
| `IntervalPlot` | What is each estimate, and how uncertain is it?             | Use it for estimates with confidence or credible intervals, such as an effect size per benchmark.              | Use DotPlot to compare several series per row, and BoxPlot to show the spread of raw values.         |
| `RankedBars`   | Which items rank highest on one measure?                    | Use it for a sorted top list, such as the features or prompts with the largest effect.                         | Use BarChart when the categories have a natural order, and DotPlot when values do not start at zero. |
| `BoxPlot`      | How do the distributions of several groups compare?         | Use it for prepared quartiles of a handful of groups, such as latency per region, with outliers marked.        | Use ViolinPlot when the shape matters, and StripPlot when there are few enough values to show each.  |
| `ViolinPlot`   | How does the shape of a distribution differ between groups? | Use it for prepared densities of a few groups when bimodality or skew matters, such as reward per policy.      | Use BoxPlot when quartiles are enough, and Ridgeline for many groups in order.                       |
| `StripPlot`    | Where does every single value of each group fall?           | Use it when there are few enough values to show each one, such as the score of every seed.                     | Use BoxPlot or ViolinPlot when there are hundreds of values per group.                               |
| `Ridgeline`    | How does a distribution shift across many ordered groups?   | Use it for prepared densities of many groups in order, such as activation values per layer.                    | Use ViolinPlot for a few unordered groups, and Histogram for one distribution.                       |

### `matrix`

Import from `@mechane-ai/elements/charts/matrix`.

| Chart               | Shows                                               | Use it when                                                                                                          | Another chart is better when                                                                                     |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Matrix`            | What is the value for every pair of two categories? | Use it for a measured value per row and column, such as accuracy per model and benchmark, with missing cells marked. | Use ConfusionMatrix, CorrelationMatrix or AttentionMatrix for those specific matrices, and DotPlot for few rows. |
| `TokenHeatmap`      | Which tokens of a text carry the most of a score?   | Use it to shade a passage by a per-token value, such as a feature’s activation or a token’s loss.                    | Use TokenExamples for several passages, and TokenPredictions for the next-token distribution.                    |
| `ConfusionMatrix`   | Which classes does a classifier confuse with which? | Use it for counts of true against predicted classes, raw or normalized per true class.                               | Use Matrix for any other value per pair, and BarChart for per-class accuracy alone.                              |
| `CorrelationMatrix` | Which measures move together?                       | Use it for prepared correlation coefficients between a few measures, such as benchmark scores across models.         | Use ScatterMatrix to see the points behind each coefficient.                                                     |
| `AttentionMatrix`   | Which earlier tokens does each token attend to?     | Use it for one head’s attention weights over a short sequence, with the causal mask shown.                           | Use TokenLinks to read the strongest links as lines between two rows of the text.                                |
| `CalendarHeatmap`   | How does a daily measure vary by week and weekday?  | Use it for one value per day over weeks or months, such as daily evaluation runs or incidents.                       | Use LineChart when the trend matters more than the weekly pattern.                                               |

### `graph`

Import from `@mechane-ai/elements/charts/graph`.

| Chart              | Shows                                                                | Use it when                                                                                                           | Another chart is better when                                                                              |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `RelationGraph`    | How are a few named things connected?                                | Use it for a small graph whose positions the application lays out, such as services and their calls.                  | Use FlowDiagram when links carry amounts, and TreeDiagram for a strict hierarchy.                         |
| `FlowDiagram`      | Where does a quantity go between stages?                             | Use it for amounts flowing between stages, such as requests from source through filter to outcome.                    | Use BridgeChart for changes to one total, and RelationGraph when links carry no amount.                   |
| `AttributionGraph` | Which features carry a model’s answer from the prompt to the output? | Use it for an attribution graph: tokens, features by layer and the output, with signed edge weights.                  | Use FlowDiagram for amounts that are conserved between stages, and TokenLinks for token-to-token weights. |
| `TreeDiagram`      | How is a hierarchy structured?                                       | Use it to show parent and child relations, such as a run’s spans or an agent’s plan, when the structure is the point. | Use Treemap or Icicle when each node carries an amount readers should compare.                            |

### `hierarchy`

Import from `@mechane-ai/elements/charts/hierarchy`.

| Chart     | Shows                                         | Use it when                                                                                | Another chart is better when                                                                        |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `Treemap` | Which parts make up most of a total?          | Use it for many parts of one total where the large parts matter, such as spend by project. | Use BreakdownBar for a few parts, Icicle for nested levels and RankedBars to compare parts exactly. |
| `Icicle`  | How does a total split through nested levels? | Use it for a hierarchy whose nodes carry amounts, such as time spent per span of a trace.  | Use Treemap for one level of many parts, and TreeDiagram when there are no amounts.                 |

### `timeline`

Import from `@mechane-ai/elements/charts/timeline`.

| Chart        | Shows                                                 | Use it when                                                                                             | Another chart is better when                                                                       |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Waterfall`  | When did each step of a request or run start and end? | Use it for the recorded timing of many steps on one scale, with exact timing stated for each row.       | Use EventStrip for events in a few lanes over a long window, and BreakdownBar for totals per step. |
| `EventStrip` | What happened when, across a few kinds of events?     | Use it for deploys, incidents, runs and alerts over hours or days, where overlaps between lanes matter. | Use Waterfall for the steps of one request, and LineChart for a measured value over time.          |

### `relationship`

Import from `@mechane-ai/elements/charts/relationship`.

| Chart                 | Shows                                                       | Use it when                                                                                                  | Another chart is better when                                                                                       |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ContourPlot`         | What does a value look like over two continuous inputs?     | Use it for a prepared grid over two inputs, such as loss over two hyperparameters, with an optimizer’s path. | Use DensityMap for counts of points, and Matrix for a value per pair of categories.                                |
| `ScatterMatrix`       | How do several measures relate to each other, pair by pair? | Use it for up to six measures of a few hundred records, such as cost, latency and accuracy per model.        | Use ScatterPlot for one pair, ParallelCoordinates for many measures, and CorrelationMatrix for coefficients alone. |
| `ParallelCoordinates` | Which records do well on many measures at once?             | Use it to filter records across many measures, such as hyperparameter trials by their settings and score.    | Use ScatterMatrix to see pairwise relations, and a table for exact values.                                         |
| `EmbeddingMap`        | How do many items cluster in a learned embedding space?     | Use it for thousands to a million projected points with groups and landmarks, drawn on canvas or WebGL.      | Use ScatterPlot when every point needs to be inspected by name, and DensityMap when only density matters.          |
| `DensityMap`          | Where are points concentrated over two measures?            | Use it for prepared two-dimensional counts of very many points, such as prompt length against latency.       | Use ScatterPlot when there are few enough points to show each, and ContourPlot for a measured surface.             |

### `text`

Import from `@mechane-ai/elements/charts/text`.

| Chart              | Shows                                                             | Use it when                                                                                                                     | Another chart is better when                                                         |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `TokenExamples`    | On which passages, and which tokens, does a feature fire?         | Use it for the top activating examples of a feature, each passage shaded by activation around its peak.                         | Use TokenHeatmap for one passage, and TokenGrid to compare several values per token. |
| `TokenPredictions` | Which tokens does the model expect next, and how did that change? | Use it for the top next-token probabilities at one position, against a baseline such as before an intervention.                 | Use RankedBars for ranked values that are not token probabilities.                   |
| `TokenGrid`        | How does a per-token value change across layers or conditions?    | Use it for one value per token and row, such as a logit-lens probability per layer.                                             | Use TokenHeatmap for a single row, and Matrix when the columns are not tokens.       |
| `TokenLinks`       | Which tokens most influence which later tokens?                   | Use it for the strongest token-to-token weights, such as attention or attribution, drawn as lines between two rows of the text. | Use AttentionMatrix to see every weight of a head.                                   |

### `image`

Import from `@mechane-ai/elements/charts/image`.

| Chart                | Shows                                                     | Use it when                                                                                                | Another chart is better when                                                          |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ImageGrid`          | What do a set of images look like, with a value for each? | Use it for a gallery of inputs or samples with a score each, such as a classifier’s most confident errors. | Use ImageAtlas when the images sit at positions in a two-dimensional layout.          |
| `AttributionOverlay` | Which parts of an image drove the model’s output?         | Use it for a saliency or attribution grid laid over one image, with an adjustable opacity.                 | Use ImageGrid to compare many images.                                                 |
| `ImageAtlas`         | How do images arrange over a two-dimensional layout?      | Use it for images placed on a grid by a projection or two factors, such as a feature visualization atlas.  | Use ImageGrid for a plain gallery, and EmbeddingMap for many points without pictures. |

## Shared props

Every chart except `Sparkline`, `Waterfall`, `ColorLegend` and the cells takes `FigureProps`. `Waterfall` takes `title`,
`report`, `locale` and `emptyLabel`.

| Prop          | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `title`       | Required. What was measured.                                                              |
| `description` | A string. One or two sentences: the period or sample and how to read it.                  |
| `locale`      | Required. The locale of every number and date, such as `"en-US"`.                         |
| `source`      | Where the data came from. It goes in the footnote.                                        |
| `coverage`    | `{ shown, total, unit }` when the figure draws part of the data. It is stated by title.   |
| `transforms`  | What you did to the data, in words: `["Smoothed over 5 steps"]`. It goes in the footnote. |
| `status`      | `'ready'`, `'loading'` or `'refreshing'`. Loading holds the final geometry.               |
| `emptyLabel`  | The sentence shown when there is nothing to draw.                                         |
| `report`      | Sets the figure in a bordered report with a summary. See "Compose a report".              |
| `actions`     | Controls beside the title. A React slot, so a JSON spec cannot carry it.                  |
| `height`      | `'compact'` (160), `'regular'` (260) or `'tall'` (380). Never a number.                   |

Application state arrives as a value with a change callback that receives the change details:

- `selected` with `onSelectedChange(id, details)` for a record the reader pressed or chose with Enter.
- `range` with `onRangeChange(range, details)` for a drawn range. `LineChart` and `AreaChart` also need `rangeStep`, a
  number in the timestamp unit. `ScatterPlot` needs `rangeStep={{ x, y }}`.
- `highlighted` for emphasis from outside, such as a table row. It does not change selection. `CurveChart`, `DotPlot`
  and `BarChart` take the id of one series, or `null` for none. `RunsChart` takes `featured`, a required list of run ids
  drawn in their hue.
- `inspected` with `onInspectedChange` on `ChartLink`.

## Declare formats

A figure never takes `formatValue`, `formatX` or a similar function prop.

```tsx
import { CurveChart } from '@mechane-ai/elements/charts/trend';

<CurveChart
  title="Validation loss"
  description="Synthetic runs. Bands span three seeds."
  locale="en-US"
  series={series}
  x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
  y={{ label: 'Loss (nats)', domain: [1, 5], format: { maximumFractionDigits: 2 } }}
  source="Synthetic sweep"
  transforms={['Mean of three seeds']}
/>;
```

- A measured axis is a `PlotAxis`: `{ label, domain?, scale?, format, tickFormat? }`. Put the unit in `label`. Leave
  `domain` out to fit round bounds. `scale` is `'linear'`, `'log'` or `'symlog'`.
- A lone measure is `valueFormat` with an optional `tickFormat`. A time axis uses `timeFormat`.
- A `ValueFormat` is `Intl.NumberFormat` options. Ticks use its compact form unless you set `tickFormat`.
- A `TimeFormat` is `Intl.DateTimeFormat` options that name a `timeZone`. A function is allowed only where no option can
  write the text, and a JSON figure spec cannot carry one.
- Timestamps reach `formatTime` in milliseconds. Set `timestampUnit` to `'seconds'` or `'milliseconds'`.

## Newer props

- `valueLabel` is the value axis title on `LineChart`, `AreaChart`, each `SmallMultiples` panel, `BarChart` and
  `BridgeChart`.
- `Sparkline` takes `layout` of `'inline'` or `'figure'`. `SparkCell` takes `label` of `'last'` or `'peak'`.
- `CurveChart` takes `markers`, a list of `{ x, label }`. `SmallMultiples` panels take `bands`.
- `EventStrip` takes `gutterWidth`. `eventStripGutter(labels)` returns one wide enough for every lane label, so stacked
  strips line up.
- `Waterfall` draws in the shared frame and takes `description`, `actions`, `source` and `transforms`.
- `IntervalPlot` and `RankedBars` take `height`, the room per row. They write no value beside a row. The readout and the
  exact-value table carry the values.
- `Matrix`, `AttentionMatrix`, `ConfusionMatrix` and `CorrelationMatrix` take `cellValues` of `'shown'` or `'hidden'`.
- Attention: the source is the token attended to and the destination is the token that attends. `AttentionMatrix` rows
  are `destinations`, columns are `sources`, and `weights` has one line per destination. A `TokenLinks` link is
  `{ sourceId, destinationId, weight }`, and `direction` is `'source-to-destination'`.

## Supply honest data

- A missing value is `null`. It draws a hollow mark or a gap and reads "Unavailable". Never write it as zero.
- Bars, histograms and other length marks start at zero. Position marks such as dots need not.
- A log axis needs positive values and says so in its title. A symlog axis holds zero and negative values.
- A chart refuses invalid input with a stated reason and never repairs, clamps, reorders or drops a record.
- A chart takes prepared values. Compute quartiles, bins, densities, fits, smoothing and ranks first, with
  `@mechane-ai/elements/charts/transforms`, and name each step in `transforms`.
- A figure that draws a sample or a window sets `coverage`, so the reader sees how much is shown.
- Grid data counts from the lowest value. `DensityMap` takes a `histogram` with one count per cell, row by row. Row 0
  holds the lowest `y` and column 0 the lowest `x`, so rows count up from the bottom. The `bin2d` transform returns this
  order.
- The title and description say what was measured, and for which period or sample.

## Limits

Most charts export a limits object and refuse more with a message that names the limit. Choose a window or an aggregate
first. A selection of the limits:

| Chart              | Limits                                                    |
| ------------------ | --------------------------------------------------------- |
| `LineChart` etc.   | `timeSeriesLimits`: 12 series, 2000 points, 200 markers   |
| `BarChart` etc.    | 200 items and 12 series. The message names the limit.     |
| `ScatterPlot`      | `scatterLimits`: 1000 points                              |
| `Matrix`           | `matrixLimits`: 4096 cells                                |
| `TokenHeatmap`     | `tokenHeatmapLimits`: 2048 tokens                         |
| `RelationGraph`    | `relationGraphLimits`: 256 nodes, 1024 edges              |
| `FlowDiagram`      | `flowLimits`: 64 nodes, 256 links                         |
| `CurveChart`       | `curveLimits`: 12 series, 2000 points per series          |
| `EmbeddingMap`     | `embeddingLimits`: 100,000 canvas points, 1,000,000 WebGL |
| `EventStrip`       | `eventStripLimits`: 12 lanes, 1000 events                 |
| `AttributionGraph` | `attributionLimits`: 400 nodes, 2000 edges, 40 layers     |
| `TreeDiagram`      | `treeLimits`: 300 nodes, depth 12                         |

The others follow the same pattern, such as `boxLimits` and `runsLimits`. Read the declaration file of the chart you
use. `BarChart`, `BridgeChart`, `BreakdownBar` and `Treemap` share `categoricalLimits` from `/charts`, and `Histogram`,
`ECDF`, `IntervalPlot` and `RankedBars` share `distributionLimits` from `/charts/distribution`. `densityLimits` from
`/charts/relationship` bounds `DensityMap`, and `densityLimits` from `/charts/transforms` bounds a density estimate.

Marks a reader inspects one by one draw as SVG. `EmbeddingMap` draws on canvas up to 100,000 points and with WebGL up to
1,000,000, and `DensityMap` draws on canvas. A canvas or WebGL plot keeps the same inspection, selection, readout and
text alternative. The WebGL figure was measured in a headless software renderer, not on a GPU.

## Selection, inspection and ranges

Inspection is built in. A plot is one Tab stop. Hover or the arrow keys inspect, Home and End reach the ends, a press or
Enter selects, a drag draws a range and Escape closes the readout. Pan and zoom are opt-in, as `isExplorable` on
`EmbeddingMap`, and a plain scroll always scrolls the page. Do not add your own tooltip or key handler.

```tsx
<RankedBars
  title="Top error sources"
  locale="en-US"
  items={items}
  value={{ label: 'Share of errors', format: { style: 'percent' } }}
  selected={selectedId}
  onSelectedChange={(id) => setSelectedId(id)}
/>
```

The app owns the linked inspector, route or filter. Leave `onSelectedChange` out for a read-only figure. `Waterfall`
requires it.

## Link figures and keep one hue per thing

Give a thing one id in every figure. `ToneScope` gives each id one hue. `ChartLink` shares one inspected id between the
figures inside it: pointing at a record in one figure marks the record with the same id in the others.

```tsx
import { ChartLink, ToneScope } from '@mechane-ai/elements/charts';
import { DotPlot } from '@mechane-ai/elements/charts/comparison';
import { CurveChart } from '@mechane-ai/elements/charts/trend';

<ToneScope ids={['small', 'base']}>
  <ChartLink>
    <CurveChart title="Loss" locale="en-US" series={curves} x={step} y={loss} />
    <DotPlot title="Score by task" locale="en-US" rows={tasks} series={scores} value={score} />
  </ChartLink>
</ToneScope>;
```

- A record's own `tone` wins over the scope. Pin a tone when color carries identity across filters.
- `ChartGrid` is a `ChartLink` and a `ToneScope` laid out as panels with one title. It takes `ids` and `tones` for the
  scope and `minPanelWidth` for the panels.
- Hovering a row in one figure highlights the same id in the others. `CurveChart` and `DotPlot` also draw the series
  with that id at full strength and fade the rest. Their `highlighted` prop overrides the link.
- `useScopedTone(id)` returns the hue the scope gives an id, or `undefined` outside a scope, so a sentence or a diagram
  matches its chart. `useChartLinkControl()` returns `{ inspected, inspect }`, or `undefined` outside a link. Call
  `inspect(id, { reason, event })` from prose to point every linked figure at an id.
- `CurveChart` takes `labels`: `'legend'` (the default), `'inline'` to write each name at the end of its line when there
  is room, or `'none'` when a legend beside a grid already names the series.
- These charts read the link: `CurveChart`, `RunsChart`, `SlopeChart`, `BumpChart`, `HorizonChart`, `DotPlot`,
  `DumbbellPlot`, `BulletBar`, `IntervalPlot`, `RankedBars`, `BoxPlot`, `ViolinPlot`, `StripPlot`, `Ridgeline`,
  `ScatterMatrix`, `ParallelCoordinates`, `EmbeddingMap`, `EventStrip`, `Icicle`, `AttributionGraph` and `TreeDiagram`.

## States

Every figure handles the same states:

- `status="loading"` shows the final geometry before the first read. Keep it inside an `AsyncRegion`.
- `status="refreshing"` keeps the drawn data while a newer read is under way.
- Empty input shows `emptyLabel`. Invalid input shows why it cannot be drawn.
- A figure that draws part of its data states how much beside its title. Set `coverage`.

`LineChart`, `AreaChart`, `SmallMultiples` and `BarChart` also have placeholders: `TimeSeriesChartPlaceholder`,
`SmallMultiplesPlaceholder` and `BarChartPlaceholder`. Use the same title, report and height as the loaded chart.

## Compose a report

Pass `report` when the chart is a self-contained analytical report with a caption, a period summary and the plot. Use
`report.summary` for mixed metrics or `report.seriesValues` for one value per series. Put scoped controls in
`report.actions` with `density="compact"`. Inside a region that already groups its content, use the chart without
`report`.

## Build a chart the library lacks

When no chart answers the question, build one from the kernel in `@mechane-ai/elements/charts/plot` so it shares the
axes, marks, readout, keyboard cursor, states and tones of the others. Do not draw your own scale, axis or SVG mark.

- Lay out with `numericPlot`, `categoryPlot` or `timePlot`, and draw with `PlotSurface`, `PlotAxes`, `PlotClip` and the
  marks: `LineMark`, `AreaMark`, `BandMark`, `DotMark`, `BarMark`, `RuleMark`, `IntervalMark`, `LabelMark`,
  `SymbolMark`, `RingMark`, `LinkMark`, `ConnectorMark` and `GuideMark`.
- Write ticks with `axisTicks` (or `timeAxisTicks` for time) and `tickTexts`. Tick text gains precision until neighbours
  differ, an axis longer than 120 px shows at least three ticks (`ticksMinimum`), and an axis that draws its title drops
  a `style: 'unit'` from its ticks. Place labels with `freeLabelSpot` and `labelBox` so they do not collide.
- Give `FigureFrame` a `seriesLegend` for a legend that names things, drawn above the plot, and a `scaleLegend` for a
  color or size scale, drawn below it.
- Wrap the plot in `Chart` for inspection, the keyboard cursor and selection. Add `ChartCursor`, `ChartInspection` or
  `ChartReadout`, and `ChartData` for the exact-value table.
- Return `FigureLoading`, `FigureEmpty` and `FigureInvalid` for the shared states, and `FigureFrame` around the plot.
- Take `FigureProps` and the format types from `@mechane-ai/elements/charts`. Write numbers with `formatValue`, instants
  with `formatTime` and hues with `useTones()`. Spread `useLinkedInspection()` into `Chart` when item ids mean the same
  thing in other charts.
- Refuse input the chart cannot draw with a reason. Do not repair it.

## Do not

- Do not pass a formatter function such as `formatValue`, `formatX` or `formatTick`. Declare a format.
- Do not hard-code a color. Use a `tone`, a `ToneScope` and the library's tokens.
- Do not compute a statistic inside a chart or in its props. Use `transforms` and name the step.
- Do not draw two value scales on one plot. Use `SmallMultiples` or two figures.
- Do not start a bar, histogram or area at a value other than zero.
- Do not use a log axis for zero or negative values. Use `scale: 'symlog'`.
- Do not fill a gap to make a line continuous, or write a missing value as zero.
- Do not use `selectedId`, `onSelect` or a `selection` object. They were removed in 0.47.
- Do not pass a pixel `height`. Use `'compact'`, `'regular'` or `'tall'`. `RelationGraph` `width` and `height` stay
  numbers: they are the extent of your node positions.
- Do not omit `locale`. A server and a browser must render the same text.
- Do not draw SVG marks yourself in a page. Build the chart from the kernel in `@mechane-ai/elements/charts/plot`, or
  add one to the library through the `extend-elements` skill.

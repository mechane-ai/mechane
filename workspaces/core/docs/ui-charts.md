# Charts

`@mechane-ai/elements/charts` exports the shared figure props, formats, tone scope, linked inspection, frames and
legends. Import each chart from its family: `/charts/cartesian`, `/charts/distribution`, `/charts/matrix`,
`/charts/graph`, `/charts/hierarchy`, `/charts/timeline`, `/charts/trend`, `/charts/comparison`, `/charts/relationship`,
`/charts/text`, `/charts/image` or `/charts/cells`. Statistics live in `/charts/transforms`, the kernel in
`/charts/plot`, and the JSON figure spec and the chart guide in `/charts/figure`. Domain pages are kits under `/kits/*`.
Import the package CSS once, as the [component guide](components.md) describes.

Applications own queries, aggregation, ranking, sampling, normalization, statistics and scientific interpretation.
Charts own geometry, inspection and presentation. The rules are
[contract 140](../.contracts/140-ui-data-display/CONTRACT.md); contracts 077, 115 and 118 keep their rules for time
series, Waterfall evidence and prepared analytical input.

## Families

Each family folder has an `index.ts` that is its public entry and a stories file per chart.

| Family         | Charts                                                                                                                       | Use                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `cartesian`    | LineChart, AreaChart, SmallMultiples, Sparkline, BarChart, BreakdownBar, BridgeChart, ScatterPlot                            | Recorded trends, grouped or additive values, signed changes and coordinates.     |
| `trend`        | CurveChart, RunsChart, SlopeChart, BumpChart, HorizonChart                                                                   | A measure over a step, layer or dose, many runs, conditions, ranks and rows.     |
| `comparison`   | DotPlot, DumbbellPlot, BulletBar                                                                                             | Named rows on one measured axis, before and after, and a value against a target. |
| `distribution` | Histogram, ECDF, IntervalPlot, RankedBars, BoxPlot, ViolinPlot, StripPlot, Ridgeline                                         | Prepared bins, cumulative samples, intervals, ranked values and group shapes.    |
| `relationship` | ContourPlot, ScatterMatrix, ParallelCoordinates, EmbeddingMap, DensityMap                                                    | Surfaces, pairs of measures, many measures per item and many placed items.       |
| `matrix`       | Matrix, ConfusionMatrix, CorrelationMatrix, AttentionMatrix, CalendarHeatmap, TokenHeatmap, ColorLegend                      | Indexed values, fixed-meaning matrices, token scores and explicit color domains. |
| `graph`        | RelationGraph, FlowDiagram, AttributionGraph, TreeDiagram                                                                    | Supplied relationships, amounts between stages, computation paths and trees.     |
| `hierarchy`    | Treemap, Icicle                                                                                                              | Area allocation and the share of each level in its parent.                       |
| `timeline`     | Waterfall, EventStrip                                                                                                        | Known intervals and instants, and events in lanes.                               |
| `text`         | TokenExamples, TokenPredictions, TokenGrid, TokenLinks, TokenText                                                            | Tokens with values, next-token ranks, layer by position grids and links.         |
| `image`        | ImageGrid, AttributionOverlay, ImageAtlas                                                                                    | Ranked images, values over a picture and thumbnails on a grid.                   |
| `cells`        | BarCell, HeatCell, ChangeCell, IntervalCell, SparkCell                                                                       | Graphics inside a table column, on one shared scale.                             |
| `transforms`   | `binValues`, `kernelDensity`, `quantile`, `boxSummary`, `ecdfPoints`, `rankSeries`, `movingAverage`, `downsample` and others | The functions that compute what a chart draws, each with a `describe...` note.   |

Kits compose these into pages. See [kits](#kits).

The public types and synthetic catalog examples are beside each implementation. Start from a family entry:

- [Cartesian](../packages/browser/elements/packages/charts/src/cartesian/index.ts),
  [Trend](../packages/browser/elements/packages/charts/src/trend/index.ts),
  [Comparison](../packages/browser/elements/packages/charts/src/comparison/index.ts) and
  [Distribution](../packages/browser/elements/packages/charts/src/distribution/index.ts).
- [Relationship](../packages/browser/elements/packages/charts/src/relationship/index.ts),
  [Matrix](../packages/browser/elements/packages/charts/src/matrix/index.ts) and
  [Graph](../packages/browser/elements/packages/charts/src/graph/index.ts).
- [Hierarchy](../packages/browser/elements/packages/charts/src/hierarchy/index.ts),
  [Timeline](../packages/browser/elements/packages/charts/src/timeline/index.ts),
  [Text](../packages/browser/elements/packages/charts/src/text/index.ts),
  [Image](../packages/browser/elements/packages/charts/src/image/index.ts) and
  [Cells](../packages/browser/elements/packages/charts/src/cells/index.ts).
- [Transforms](../packages/browser/elements/packages/charts/src/transforms/index.ts).

## Choose a chart

This section is the library's own `chartGuide`, written out: one entry per registered chart, 50 in all, grouped by
family. Each family is the import entry `@mechane-ai/elements/charts/<family>`. The guide's `question` is what the chart
shows and its `use` is when to choose it. Its `avoid` names the chart to use instead, and the
[chart guide skill](../packages/browser/elements/skills/use-elements/references/charts.md) lists it too.

`chartGuide` is exported from `@mechane-ai/elements/charts/figure`, so an agent can read the same guidance at run time.
Each entry also carries a small valid `example` figure spec. `figureCharts` lists the registered names and families.
`ColorLegend`, the table cells, the placeholders and the kits are not registered charts and are not in the guide. Use a
table when exact comparison matters more than shape.

### `trend`

| Chart          | Shows                                                                    | Use it when                                                                                                                      |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `CurveChart`   | How did a metric change over training steps or another ordered variable? | Use it for loss, accuracy or any measure over steps, layers or doses, on linear or log axes, with bands for spread across seeds. |
| `RunsChart`    | How does one run compare with the whole sweep it belongs to?             | Use it for many training runs at once: every run stays gray context and only the runs you name are drawn in color.               |
| `SlopeChart`   | How did each item move between two to six conditions?                    | Use it to compare before and after, or a few checkpoints, where the direction of each change matters more than the path.         |
| `BumpChart`    | How did the ranking of items change across stages?                       | Use it when the order matters more than the values: a leaderboard over releases, or model rank per evaluation round.             |
| `HorizonChart` | Which of many series run above or below normal, and when?                | Use it for dozens of aligned series in little height, such as the error rate of every service over a day.                        |

### `comparison`

| Chart          | Shows                                                    | Use it when                                                                                                         |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DotPlot`      | How do a few models compare on each of several measures? | Use it to compare values across categories without bars, when the axis need not start at zero and intervals matter. |
| `DumbbellPlot` | How much did each row change between two measurements?   | Use it for many rows with exactly two values each, such as scores before and after fine-tuning.                     |
| `BulletBar`    | Is each measure meeting its target?                      | Use it for a few key measures held against targets and qualitative bands, such as latency against its objective.    |

### `cartesian`

| Chart            | Shows                                                             | Use it when                                                                                                |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BarChart`       | How large is each amount, by category and series?                 | Use it for amounts measured from zero across a few categories, grouped or stacked by series.               |
| `BridgeChart`    | Which changes add up to the difference between two totals?        | Use it to explain a change from one total to another as a sequence of signed parts, such as cost by cause. |
| `BreakdownBar`   | How does one total split into parts?                              | Use it for a single total and a few named parts, such as where the time of a request went.                 |
| `ScatterPlot`    | How do two measures of the same records relate?                   | Use it for up to a thousand records with two measures each, such as cost and accuracy per model.           |
| `LineChart`      | How did a measure change over time?                               | Use it for a few series over timestamps, such as latency per minute or requests per hour.                  |
| `AreaChart`      | How did a total and its parts change over time?                   | Use it stacked for parts that add up to a meaningful total over time, such as requests by region.          |
| `SmallMultiples` | How do several related measures move together over the same time? | Use it for a few measures with different units on one shared time axis, inspected together.                |
| `Sparkline`      | Which way is one measure trending, at a glance?                   | Use it inline beside a number or in a dense summary, where a full chart would be too much.                 |

### `distribution`

| Chart          | Shows                                                       | Use it when                                                                                                    |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Histogram`    | How are the values of one measure distributed?              | Use it for the shape of one distribution from prepared bins, such as response lengths or latencies.            |
| `ECDF`         | What share of values falls below a given level?             | Use it to read percentiles and compare tails exactly, such as the share of requests under a latency objective. |
| `IntervalPlot` | What is each estimate, and how uncertain is it?             | Use it for estimates with confidence or credible intervals, such as an effect size per benchmark.              |
| `RankedBars`   | Which items rank highest on one measure?                    | Use it for a sorted top list, such as the features or prompts with the largest effect.                         |
| `BoxPlot`      | How do the distributions of several groups compare?         | Use it for prepared quartiles of a handful of groups, such as latency per region, with outliers marked.        |
| `ViolinPlot`   | How does the shape of a distribution differ between groups? | Use it for prepared densities of a few groups when bimodality or skew matters, such as reward per policy.      |
| `StripPlot`    | Where does every single value of each group fall?           | Use it when there are few enough values to show each one, such as the score of every seed.                     |
| `Ridgeline`    | How does a distribution shift across many ordered groups?   | Use it for prepared densities of many groups in order, such as activation values per layer.                    |

### `matrix`

| Chart               | Shows                                               | Use it when                                                                                                          |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Matrix`            | What is the value for every pair of two categories? | Use it for a measured value per row and column, such as accuracy per model and benchmark, with missing cells marked. |
| `TokenHeatmap`      | Which tokens of a text carry the most of a score?   | Use it to shade a passage by a per-token value, such as a feature’s activation or a token’s loss.                    |
| `ConfusionMatrix`   | Which classes does a classifier confuse with which? | Use it for counts of true against predicted classes, raw or normalized per true class.                               |
| `CorrelationMatrix` | Which measures move together?                       | Use it for prepared correlation coefficients between a few measures, such as benchmark scores across models.         |
| `AttentionMatrix`   | Which earlier tokens does each token attend to?     | Use it for one head’s attention weights over a short sequence, with the causal mask shown.                           |
| `CalendarHeatmap`   | How does a daily measure vary by week and weekday?  | Use it for one value per day over weeks or months, such as daily evaluation runs or incidents.                       |

### `graph`

| Chart              | Shows                                                                | Use it when                                                                                                           |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `RelationGraph`    | How are a few named things connected?                                | Use it for a small graph whose positions the application lays out, such as services and their calls.                  |
| `FlowDiagram`      | Where does a quantity go between stages?                             | Use it for amounts flowing between stages, such as requests from source through filter to outcome.                    |
| `AttributionGraph` | Which features carry a model’s answer from the prompt to the output? | Use it for an attribution graph: tokens, features by layer and the output, with signed edge weights.                  |
| `TreeDiagram`      | How is a hierarchy structured?                                       | Use it to show parent and child relations, such as a run’s spans or an agent’s plan, when the structure is the point. |

### `hierarchy`

| Chart     | Shows                                         | Use it when                                                                                |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Treemap` | Which parts make up most of a total?          | Use it for many parts of one total where the large parts matter, such as spend by project. |
| `Icicle`  | How does a total split through nested levels? | Use it for a hierarchy whose nodes carry amounts, such as time spent per span of a trace.  |

### `timeline`

| Chart        | Shows                                                 | Use it when                                                                                             |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Waterfall`  | When did each step of a request or run start and end? | Use it for the recorded timing of many steps on one scale, with exact timing stated for each row.       |
| `EventStrip` | What happened when, across a few kinds of events?     | Use it for deploys, incidents, runs and alerts over hours or days, where overlaps between lanes matter. |

### `relationship`

| Chart                 | Shows                                                       | Use it when                                                                                                  |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ContourPlot`         | What does a value look like over two continuous inputs?     | Use it for a prepared grid over two inputs, such as loss over two hyperparameters, with an optimizer’s path. |
| `ScatterMatrix`       | How do several measures relate to each other, pair by pair? | Use it for up to six measures of a few hundred records, such as cost, latency and accuracy per model.        |
| `ParallelCoordinates` | Which records do well on many measures at once?             | Use it to filter records across many measures, such as hyperparameter trials by their settings and score.    |
| `EmbeddingMap`        | How do many items cluster in a learned embedding space?     | Use it for thousands to a million projected points with groups and landmarks, drawn on canvas or WebGL.      |
| `DensityMap`          | Where are points concentrated over two measures?            | Use it for prepared two-dimensional counts of very many points, such as prompt length against latency.       |

### `text`

| Chart              | Shows                                                             | Use it when                                                                                                                     |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `TokenExamples`    | On which passages, and which tokens, does a feature fire?         | Use it for the top activating examples of a feature, each passage shaded by activation around its peak.                         |
| `TokenPredictions` | Which tokens does the model expect next, and how did that change? | Use it for the top next-token probabilities at one position, against a baseline such as before an intervention.                 |
| `TokenGrid`        | How does a per-token value change across layers or conditions?    | Use it for one value per token and row, such as a logit-lens probability per layer.                                             |
| `TokenLinks`       | Which tokens most influence which later tokens?                   | Use it for the strongest token-to-token weights, such as attention or attribution, drawn as lines between two rows of the text. |

### `image`

| Chart                | Shows                                                     | Use it when                                                                                                |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ImageGrid`          | What do a set of images look like, with a value for each? | Use it for a gallery of inputs or samples with a score each, such as a classifier’s most confident errors. |
| `AttributionOverlay` | Which parts of an image drove the model’s output?         | Use it for a saliency or attribution grid laid over one image, with an adjustable opacity.                 |
| `ImageAtlas`         | How do images arrange over a two-dimensional layout?      | Use it for images placed on a grid by a projection or two factors, such as a feature visualization atlas.  |

## The kernel

Every chart is built from the plot kernel. A chart owns its input types, its validation and the arrangement of kernel
parts. It does not make another scale, tick, axis or path. Add to the kernel only what a named chart needs.

| File                                                                      | Owns                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `plot/scale.ts`                                                           | `continuousScale` and `bandScale`, domain checks (`isFiniteDomain`, `outsideDomain`, `scaleDomainError`).                             |
| `plot/ticks.ts`, `plot/plot-layout.ts`                                    | Linear, log, symlog and time ticks, `axisTicks`, `timeAxisTicks`, `tickTexts`.                                                        |
| `plot/path.ts`                                                            | `linePath`, `areaPath` and `linkPath`, with breaks at missing values.                                                                 |
| `plot/plot-layout.ts`                                                     | `PlotAxis`, `plotHeights`, margins, `fitDomain`, `numericPlot`, `categoryPlot`, `timePlot`, `axisTitle`.                              |
| `plot/plot-axes.tsx`                                                      | Axis lines, tick labels, grid and titles.                                                                                             |
| `plot/plot-surface.tsx`                                                   | `PlotSurface`, `PlotClip` and `usePlotSize`: the one Tab stop, its label and the clip.                                                |
| `plot/plot-marks.tsx`                                                     | The marks: line, area, band, dot, bar, rule, interval, label, symbol, ring, link, connector and guide.                                |
| `plot/locate.ts`, `plot/label-place.ts`                                   | `locateNearest`, the hit test, and `freeLabelSpot` and `labelBox` for labels that do not collide.                                     |
| `plot/contours.ts`                                                        | Level lines of a gridded surface.                                                                                                     |
| `plot/render/*`                                                           | Canvas and WebGL point layers, the density layer, the hit index and the pan and zoom viewport.                                        |
| `figure/figure-props.ts`                                                  | `FigureProps`, `SeriesFigureProps`, `FigureSelectionProps`, `FigureCoverage` and `FigureStatus`.                                      |
| `figure/figure-format.ts`                                                 | `ValueFormat`, `TimeFormat`, `formatValue`, `formatTime` and `tickFormat`.                                                            |
| `figure/figure-frame.tsx`                                                 | `FigureFrame` with its `seriesLegend` and `scaleLegend` slots, `FigureLoading`, `FigureEmpty` and `FigureInvalid`.                    |
| `figure/tone-scope.tsx`                                                   | `ToneScope`, `useTones` and `useScopedTone`.                                                                                          |
| `chart.tsx`, `chart-inspection.tsx`, `chart-cursor.tsx`, `chart-data.tsx` | The shared `Chart` primitive for inspection, keyboard cursor and selection, the readout, the cursor and the hidden exact-value table. |
| `chart-link.tsx`, `chart-grid.tsx`                                        | `ChartLink`, `useChartLinkControl` and `ChartGrid`: one inspection and one tone scope across figures.                                 |
| `spec/*`                                                                  | `FigureSpec`, the registry of chart names, `validateFigureSpec`, `Figure`, `describeFigure`, the chart guide and the wall story.      |

The kernel is public as `/charts/plot` for a chart the library lacks. `CurveChart` in
[`trend/curve-chart.tsx`](../packages/browser/elements/packages/charts/src/trend/curve-chart.tsx) is the reference for
how the parts fit together.

## Add a chart

1. **Pick the family** by what the reader asks, and add the file to its folder. Name it for what a reader calls it.
2. **Type the props** as `FigureProps & { ...inputs }`, adding `FigureSelectionProps` when the reader can select. Name
   things as the other charts do: `selected`, `range`, `highlighted`, `value`, `x`, `y`, `valueFormat`, `height`. Never
   add a second spelling.
3. **Follow the structure of `curve-chart.tsx`.** Return `FigureLoading` for `status="loading"`. Resolve domains with
   `axis.domain ?? fitDomain(...)`. Validate and return `FigureInvalid` on the first problem, never repairing, clamping,
   reordering or dropping. Lay out with `numericPlot` or `categoryPlot`. Render `Chart` with `items`, `locate` and a
   `render` that returns `FigureFrame` around `PlotSurface`, `PlotAxes` and `PlotClip` with kernel marks. Return
   `FigureEmpty` for empty input.
4. **Write numbers with `formatValue` and instants with `formatTime`**, from the figure's `locale` and a declared
   format. Axis ticks use `axis.tickFormat ?? tickFormat(axis.format)`.
5. **Resolve each record's tone** with `useTones()`. Spread `useLinkedInspection()` into `Chart` when item ids mean the
   same thing across charts.
6. **Give every item a readout sentence** with the exact values. Add `ChartInspection` or `ChartReadout`, the keyboard
   cursor and `ChartData`. Point the plot's `aria-describedby` at the readout.
7. **Export a limits object** named `<chart>Limits` and refuse more with a message that names it.
8. **Export the chart and its types** from the family `index.ts`.
9. **Register it** so the figure spec can name it. Add its props type to `FigureChartProps` in `spec/figure-spec.ts`,
   and a new family to `FigureFamily`. Add an entry to `spec/figure-registry.tsx` with the component, its family, the
   required props with their JSON kinds and `isSelectable`. A chart that takes a callback or a slot stays describable:
   only the callbacks and slots are left out of the spec.
10. **Add a guide entry** in `spec/chart-guide.tsx`: the question the chart answers, when to use it, which chart is
    better otherwise and a small valid example spec. The types require one entry for every registered chart.
11. **Write the stories** and check the chart on the wall. See [stories](#stories).

## Channels

Each visual channel carries one meaning. Draw through the kernel marks, which carry these meanings, and do not restyle
them per chart.

| Channel                          | Meaning                                                |
| -------------------------------- | ------------------------------------------------------ |
| Hue                              | Which thing. One thing keeps one hue across a page.    |
| Lightness on one hue             | A magnitude.                                           |
| Two hues around a neutral middle | A signed value around zero.                            |
| Dashed stroke                    | Modelled: a fit, a projection, a baseline or a target. |
| Pale band                        | Uncertainty.                                           |
| Hollow mark                      | Missing, masked or excluded.                           |
| Gray                             | Context.                                               |
| Size                             | A magnitude, with a legend.                            |

A mark whose length carries an amount starts at zero. A log or symlog axis says so in its title, and a log axis rejects
zero and negative values. A domain the caller leaves out is fitted to round bounds by the kernel. One plot never has two
value scales.

## Composition

Use `report` when the chart is a self-contained analytical report. Its compact caption, period summary and plot form one
subtle boundary. Supply mixed metrics with `report.summary`, or matching bar and time-series metrics with
`report.seriesValues`. Keys match the supplied series identifiers. Explicit undefined values reserve loading space. The
period summary stays steady while the inspector shows an individual observation.

Supply scoped controls through `report.actions` with explicit `density="compact"`. Charts add no default data-dialog
control. Popup options and dialog contents keep standard density. The
[Report captions examples](../packages/browser/elements/packages/charts/src/chart-frame.stories.tsx) show local
controls, matching loading geometry, and long labels at narrow widths. The
[geometry guide](visual-system.md#geometry-and-alignment) owns caption and control sizing.

Use the ordinary chart inside a region that already owns its grouping, such as an inspector or composed message. Every
full chart still owns its title and value inspection. `FigureFrame` supplies title, summary, action and footnote layout
for a custom plot. Let one frame own a report's boundary and use Stack for related sections in page flow. The
[composition guide](visual-system.md#composition-decisions) explains table width and parent layout choices.

Put figures that show the same things in a `ChartGrid`, or in a `ToneScope` and `ChartLink` of their own. The grid gives
one title, one inspection and one tone scope to its panels. A term in prose reads the same link through
`useChartLinkControl`, and takes the hue of a thing from `useScopedTone`.

## Data and interaction

Application state arrives as a value with a change callback that receives the SDK change details: `selected` with
`onSelectedChange`, `range` with `onRangeChange`, `inspected` with `onInspectedChange`. Omit the callback for a
read-only figure. The chart reports an identifier; the application owns the linked inspector, URL or other view.

Interaction follows one grammar. Hover or the arrow keys inspect, a press or Enter selects, a drag draws a range, Escape
dismisses and the plot is one Tab stop. Every pointer gesture has a keyboard path and an agent action. Pan and zoom are
opt-in, as on `EmbeddingMap`, and a scroll never pans or zooms by default. The `Chart` primitive offers `inspect`,
`dismiss` and `select` to an agent.

Time series require finite, strictly increasing timestamps in declared seconds or milliseconds. Every series has one
observation at each timestamp. A missing value is `null`; it creates a visible gap. Stacked observations must be present
and nonnegative. Point annotations identify an existing series, timestamp, and recorded value.

A band is a shaded range between supplied lower and upper values with an optional center line. It shares the series
timestamps; a missing pair of bounds leaves a gap. An `event` marker names an instant inside the observed range, which
may fall between observations. A crossing marks where a drawn series or band center first reaches a value, interpolated
as the line is drawn. When it never does, the marker list says so.

`LineChart` and `AreaChart` support pointing, tapping, arrow keys, Home, End, and Escape. One inspected timestamp drives
the guide and readable values. They take a `range` with `onRangeChange` and a `rangeStep` in the timestamp unit.
`ScatterPlot` takes a controlled `range` with a `rangeStep` per axis. A range describes supplied coordinates; it does
not calculate a new embedding or select a dataset outside the supplied window.

A figure that draws series takes emphasis from outside without changing its selection. `CurveChart`, `DotPlot` and
`BarChart` take `highlighted`: the id of the one series drawn at full strength while the others fade, or `null` for
none. Left out on `CurveChart` and `DotPlot`, it follows the enclosing `ChartLink`, so hovering a table row that
inspects a series id lights that series. `RunsChart` takes `featured`, a required list of run ids drawn in their hue.
`CurveChart` also takes `labels`: `'legend'` (the default) names series in the legend, `'inline'` writes each name at
the end of its line when there is room, and `'none'` leaves them out when a legend beside a grid of panels already names
them.

Linked inspection is shared by id. Inside a `ChartLink` or `ChartGrid`, inspecting a record in one figure marks the
record with the same id in each other figure that draws it. `CurveChart`, `RunsChart`, `SlopeChart`, `BumpChart`,
`HorizonChart`, `DotPlot`, `DumbbellPlot`, `BulletBar`, `IntervalPlot`, `RankedBars`, `BoxPlot`, `ViolinPlot`,
`StripPlot`, `Ridgeline`, `ScatterMatrix`, `ParallelCoordinates`, `EmbeddingMap`, `EventStrip`, `Icicle`,
`AttributionGraph` and `TreeDiagram` read the link. Prose and diagrams join it with `useChartLinkControl`, which returns
`{ inspected, inspect }`, or `undefined` outside a link.

Use `TimeSeriesChartPlaceholder` for an initially pending LineChart or AreaChart, and `SmallMultiplesPlaceholder` for
the aligned group. Supply the same title, report, description, series labels, height and heading actions as the loaded
chart. `BarChartPlaceholder` uses known series identities when available. Other charts show `FigureLoading` at their
final geometry. Placeholders reserve geometry without observations or interactive controls. The surrounding AsyncRegion
owns the busy state and delayed loading announcement. Keep the real chart mounted during refresh.

Sparkline is a passive 128 × 32 inline trend for a metric row. It requires an application-written `summary`, a value
`unit`, `timestampUnit`, and an explicit `valueDomain`, and has no focus, hover, or inspection state. Use LineChart when
the reader needs to inspect individual observations. The table cells in `/charts/cells` take the same formats, tones and
channel meanings in a compact frame.

## Formats and locale

Write every number through `formatValue` and every instant through `formatTime`, with the figure's required `locale`.
There is no formatter-function prop.

- A `ValueFormat` is `Intl.NumberFormat` options. A function is allowed where no option can write the text.
- A `TimeFormat` is `Intl.DateTimeFormat` options that name a `timeZone`.
- A `PlotAxis` is `{ label, domain?, scale?, format, tickFormat? }`. Put the unit in `label`. Ticks use the compact form
  of `format` unless `tickFormat` is set.
- A figure of one measure takes `valueFormat` and optional `tickFormat`. A time axis takes `timeFormat`.
- Heights are `'compact'` (160), `'regular'` (260) and `'tall'` (380).

## Evidence

BarChart supports pointer, tap, and arrow-key inspection. Home and End reach the boundary categories; Escape dismisses
the readout. An optional controlled selection responds to click or Enter. Category `label` retains the full meaning in
inspection and accessible exact values. Optional `axisLabel` supplies a concise tick such as “Oct 6” without changing
record identity. Use `tickFormat` for compact axes and `valueFormat` for exact inspection and data values. Supply
`highlighted` for temporary emphasis from a linked row. Connect a DataTable through its `onRowHighlightChange` callback
and map its stable row identity to the corresponding series identity. Hover and keyboard inspection leave activation,
selected records and application queries unchanged.

BarChart can explain a comparison without another chart. `referenceLines` draw labelled targets or averages, named in a
right gutter beside their lines. `markers` add a tick or a range whisker to each bar of one series, on the value axis
rather than the stack. `annotations` place a short note above chosen bars. `emphasizedCategoryIds` recede the other
categories without changing inspection or selection. Every overlay joins the inspector, keyboard readout and exact
values.

Bar domains include zero. Grouped bars can show signed values; stacked bars require nonnegative observations. Missing
values remain unavailable, and a zero remains a zero. BreakdownBar receives a declared total, shows any unassigned
portion, and tolerates arithmetic rounding without changing the displayed measurements.

BridgeChart begins with one `start` step, adds signed `change` steps, and shows the running total at each `total` step.
Columns float from the running total and dashed connectors carry it on. Totals start at zero. Labels carry the sign, so
color is never the only cue. A missing change leaves every later level unknown, drawn as a dashed placeholder.

Histogram receives bins and counts, including irregular bin widths; a bin with no recorded count is hollow. ECDF
receives prepared cumulative points and draws steps without estimating a distribution. IntervalPlot draws a bound only
when it exists; its interval label states whether bounds mean a confidence interval, quantiles, or another measure.
RankedBars preserves supplied order. BoxPlot, ViolinPlot, StripPlot and Ridgeline take the quartiles, densities and
points the application computed, and say what the whiskers and densities mean.

Matrix uses compact square cells. Short glyphs distinguish masked, missing, and unsupplied cells from recorded zero.
Full accessible labels, the exact-value table, and the selected-cell inspector retain the exact values and reasons.
ColorLegend shows the declared domain. Diverging scales identify zero even when their bounds are asymmetric. Values
outside the color domain retain their exact text and an explicit status instead of silently saturating the color. Matrix
`variant="strip"` draws compact intensity rows that fill the width. ConfusionMatrix, CorrelationMatrix, AttentionMatrix
and CalendarHeatmap fix the meaning of cells, domain and palette for their question.

TokenHeatmap preserves supplied indices and exact text, including whitespace. The application supplies the score's
meaning. An attention weight or attribution score is not automatically a causal explanation. Token selection also has
full-sized index controls for whitespace and short tokens.

FlowDiagram places nodes in columns by their longest incoming path and keeps their supplied order within a column. Node
height and ribbon width share one scale. A null amount draws a dashed thread and adds nothing; a node whose outflow is
smaller than its inflow keeps the difference as uncovered height. Links may not form a cycle. RelationGraph draws only
supplied edges. Node positions, dimensions, and group memberships come from the caller, and proximity never creates an
edge.

Axis and tick rules are in the kernel. Tick text gains precision until neighbours differ, an axis longer than 120 px
shows at least three ticks, and an axis that draws its title drops a `style: 'unit'` from its ticks. `LineChart`,
`AreaChart`, each `SmallMultiples` panel, `BarChart` and `BridgeChart` take `valueLabel`, the value axis title. A legend
that names things goes to the `seriesLegend` slot of `FigureFrame` and `ChartFrame`, above the plot. A color or size
scale goes to `scaleLegend`, below it.

`Sparkline` takes `layout` of `'inline'` (the default) or `'figure'`. `CurveChart` takes `markers`, `{ x, label }` marks
on the step axis (type `CurveMarker`). `SmallMultiples` panels take `bands`. `Waterfall` draws in the shared frame and
takes `description`, `actions`, `source` and `transforms`. `IntervalPlot` and `RankedBars` take `height`, the room per
row, and write no value beside a row: the readout and the exact-value table carry the values. `SparkCell` takes `label`
of `'last'` or `'peak'`.

`Matrix`, `AttentionMatrix`, `ConfusionMatrix` and `CorrelationMatrix` take `cellValues` of `'shown'` (the default) or
`'hidden'`, for small color-only panels. Matrices, `TokenHeatmap`, `TokenExamples`, `TokenGrid` and `TokenLinks` share
inspection inside a `ChartLink`. In attention, the source is the token attended to and the destination is the token that
attends. `AttentionMatrix` rows are `destinations`, columns are `sources`, and `weights` has one line per destination. A
`TokenLinks` link is `{ sourceId, destinationId, weight }` and its `direction` is `'source-to-destination'`.

`EventStrip` takes `gutterWidth`, and `eventStripGutter(labels)` returns one that holds every lane label, so stacked
strips share a gutter and their time axes line up.

`EventStrip` draws events in lanes over a `domain` of milliseconds. An event with no `end` is an instant and one with an
`end` is a bar. `markers` draw a dashed rule across every lane. Its time format is `Intl` options that name a time zone,
or a function with a separate `timeZone` so the axis ticks fall on that zone's clock. A spec carries the options form.

`AttributionGraph` draws the layers of a model in the order computation flows, with supplied nodes and signed edge
weights. Each node is a `token`, a `feature`, an `error` or an `output`. An error node is hollow: it is the part the
features leave unexplained. Every edge must run from an earlier layer to a later one, and the graph never reorders
nodes. A reader pins nodes to build a subgraph with the Pin control or the P key, and the application holds `pinned`
with `onPinnedChange`. An attribution weight describes a supplied path; the application owns what it means.

`TreeDiagram` draws one root and the nodes under it from `parentId`, and refuses a missing or second root, an unknown
parent or a cycle. Use it for structure. When nodes carry amounts to compare, use `Treemap` or `Icicle`.

`DensityMap` takes a histogram that the application counted: `columns` by `rows` cells, one count per cell, row by row.
Row 0 holds the lowest `y` values and column 0 the lowest `x` values, so rows count up from the bottom of the plot. The
`bin2d` transform returns this order.

## Limits and renderers

A chart refuses oversized input with a message that names the limit. It never draws a partial chart that looks complete.
The application chooses and labels a window or an aggregate, and sets `coverage` when the figure draws a sample. Invalid
identifiers, dimensions, domains or intervals show a clear error instead of repairing records.

Most charts export their limit as a `<chart>Limits` object beside the implementation, such as `timeSeriesLimits`,
`scatterLimits`, `matrixLimits`, `tokenHeatmapLimits`, `relationGraphLimits`, `flowLimits`, `curveLimits`, `boxLimits`,
`attributionLimits`, `treeLimits`, `eventStripLimits` and `embeddingLimits`. Search the family folder for `Limits =`.
`BarChart`, `BridgeChart`, `BreakdownBar` and `Treemap` share `categoricalLimits`, exported from `/charts`. `Histogram`,
`ECDF`, `IntervalPlot` and `RankedBars` share `distributionLimits`, exported from `/charts/distribution`. The
`densityLimits` of `/charts/relationship` is the `DensityMap` grid and differs from the one in `/charts/transforms`,
which bounds the density estimate. The `MAX_*` constants of earlier versions are gone. These limits do not authorize
silently discarding observations.

Choose the renderer by the limit. SVG draws marks a reader inspects one by one. Canvas and WebGL draw the rest through
`plot/render`. `EmbeddingMap` draws on canvas up to 100,000 points and with WebGL up to 1,000,000, and `DensityMap`
draws a grid on canvas. A canvas or WebGL plot keeps the same inspection, selection, readout and text alternative as an
SVG plot. The WebGL figure was measured in a headless software renderer, not on a GPU. Without WebGL the map falls back
to canvas and says so.

Use a table when precise comparison matters more than shape. No component fetches data or computes an embedding.

## Statistics

A chart draws what it is given. Binning, density estimates, quantiles, fits, smoothing, ranking and sampling are named
functions in [`charts/src/transforms`](../packages/browser/elements/packages/charts/src/transforms/index.ts), public as
`@mechane-ai/elements/charts/transforms`. The application calls them and names each step in the figure's `transforms`.

- A transform that can reject its input returns `{ kind: 'ok', ... }` or `{ kind: 'invalid', message }`.
- Each has a `describe...` function that writes its footnote, such as `describeBoxSummary`, so the method is stated in
  the reader's words.
- A transform treats `null`, `NaN` and infinite values as missing and leaves them out of every statistic.

`bin2d` counts points into the grid that `DensityMap` reads, and `describeBin2d` writes its footnote. Do not compute a
statistic in a chart, a kit or a story prop. Add a transform instead.

## Figure spec

A figure spec is `{ chart, props }` as plain JSON: the name of a registered chart and its props without callbacks and
React content. `@mechane-ai/elements/charts/figure` exports:

- `FigureSpec`, the type of a spec, and `FigureSpecOf<Chart>` for one chart.
- `validateFigureSpec(input)`, which returns `{ kind: 'ok', spec }` or `{ kind: 'invalid', message }`. The check is
  structural, never throws, and suggests close names for a chart name that is not registered.
- `Figure`, which draws a spec. `selected`, `onSelectedChange` and `status` arrive beside the spec because JSON cannot
  carry them. A spec that fails the check draws the shared invalid figure with the reason.
- `describeFigure(spec)`, the figure as one short text for a place that cannot draw it.
- `figureCharts`, the name and family of every registered chart, and `chartGuide`, described in
  [choose a chart](#choose-a-chart).

The [package README](../packages/browser/elements/README.md#describe-a-figure-as-json) shows a spec with the text
`describeFigure` returns for it. Each chart still checks its own values.

## Kits

A kit under `packages/kits/src/<kit>` composes charts for a domain: `explainers`, `training`, `operations`, `evaluation`
and `interpretability`. It adds no marks, scales or axes. It decides which figures answer the question, shares one tone
scope and one linked inspection, and writes the words. Kit components take `locale`, declared formats, `status` and a
partial `labels` object, and compute nothing. The explainers kit takes content slots in place of data. Import other
families only through their public entries. The rules are [contract 141](../.contracts/141-ui-domain-kits/CONTRACT.md).

The interpretability kit, `@mechane-ai/elements/kits/interpretability`, has `FeatureCard`, `FeatureList`,
`AttributionWorkbench`, `AttentionHeadGrid`, `LogitLens`, `EmbeddingAtlas` and `SteeringPanel`. A feature keeps one id
in the list, the card, the map and the attribution graph. The application supplies activations, attributions, attention
weights and decoded layers. The kit never runs a model.

## Appearance

`FigureFrame` and `ChartLegend` give custom plots the shared title, description, actions, footnote and labeled color
roles. Full charts include their own frame and legend. The canonical tokens supply light and dark colors. Components
measure available width so responsive plots keep readable labels.

Give each thing one hue with a `ToneScope`. A record's own `tone` wins over the scope, so pin tones when color carries
identity across filters. Never hard-code a color: use `chartToneColors`, `chartToneOutlines` and the tokens. Use
`ChartSeriesMarker` beside a label in a legend or related table row. Use `Meter layout="inline"` from `/feedback` for a
caller-formatted bounded value in a numeric table cell. The
[marker examples](../packages/browser/elements/packages/charts/src/chart-series-marker.stories.tsx) and
[measurement examples](../packages/browser/elements/packages/feedback/src/feedback.stories.tsx) show these roles.

Charts keep their exact-value alternatives static. Use arrow keys in a plot to inspect observations and Enter to select.
Matrix and graph alternatives retain cell states and relationships. A visible breakdown table is supplied by the
application; charts add no data accordion.

## Stories

Stories are documentation and the review surface. They are not an assertion suite.

- Each chart has one stories file beside it, `<chart>.stories.tsx`, with the title `Charts/<ChartName>`, flat and
  unique. Each kit has one file titled `Kits/<Kit name>`.
- `component` names the chart, and `parameters.docs.description.component` says in two or three sentences what it shows,
  when to use it and what the application must supply.
- A chart has a realistic default story with data labelled synthetic, an interactive story that holds state with
  `useState` where selection or a range applies, and a `States` story with loading, empty, partial (`coverage`) and
  invalid.
- Use `locale="en-US"` and closed-form, deterministic data. No clock, no random numbers.
- The `Charts/Wall` page, in `spec/wall.stories.tsx`, is one page that draws every registered chart through `Figure`
  from its guide example. It has one story per family and an `All` story. A new chart appears there once it has a guide
  entry. Compare its frame, axes, ticks, legend, readout, footnote and states with its neighbors in the light and dark
  themes and at phone width. `Charts/Figure` shows a JSON spec beside the chart, invalid specs and `describeFigure`.
- Check by pointer, touch and keyboard that the readout states the supplied values, and render the chart from its figure
  spec to confirm it matches the direct call.

The catalog contains synthetic missing, zero, masked, signed, partial, narrow, invalid, and linked-selection examples.
These examples document public behavior. They do not imply that the Mechane API produces every illustrated dataset.

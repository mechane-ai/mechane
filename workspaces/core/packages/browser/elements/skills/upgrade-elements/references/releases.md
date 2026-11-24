# Release notes for applications

Newest first. Each section lists what an application must change, then what it may adopt.

## 0.48

Elements has a teaching family: lessons, diagrams with identity, explorable essays and tutor tools. It adds six entries
and removes one. The only breaking change is that the `/kits/explainers` entry is gone. Its exports moved to the new
entries or were removed, with no aliases: change each import.

### Change

- **`/kits/explainers` is removed.** Each export has a new home or is gone, as the table shows. An essay is not a kit
  any more. It is an `Article` on a lesson, from `/article`, `/lesson` and `/scene`.

  | Old import from `/kits/explainers`                            | New import                               | What changed                                                                                                                                                                                                      |
  | ------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `BoundValue`                                                  | `BoundValue` from `/lesson`              | Nothing. Same props and types (`BoundValueProps`, `BoundValueScale`, `BoundValueChangeDetails`). Inside a lesson, `<Param name="…" />` is the bound value of a declared param.                                    |
  | `Explainer`                                                   | `Article` from `/article`                | The `figures` list is gone: figures are numbered in reading order from each `Figure`. `Article` needs `lesson` (from `defineLesson`), `locale` and `title`, and renders the lesson, tone scope and chart link.    |
  | `NumberedFigure`                                              | `Figure` from `/article`                 | `id`, `caption` and `children` are the same. It adds `description`, `reads` and `size`. It must sit inside an `Article`; outside one it shows an error.                                                           |
  | `FigureReference`                                             | `FigureReference` from `/article`        | Same `to` prop. The number comes from the article's `Figure`s.                                                                                                                                                    |
  | `Term`                                                        | `Term` from `/article`                   | Same `inspects` and `children`. It adds an optional `labels` prop with the hint text.                                                                                                                             |
  | `DiagramPart`                                                 | `DiagramPart` from `/article`            | Same `inspects`, `label` and `children`. It adds an optional `labels` prop.                                                                                                                                       |
  | `StorySteps`                                                  | `Scrolly` and `ScrollyStep`, or `Reveal` | Removed with its types `StoryStep`, `StoryStepChangeDetails`, `StoryStepsLabels` and `StoryStepsProps`. `ScrollyStep` sets lesson values (`values` or `state`) as the reader scrolls. It has no `inspected` prop. |
  | types `ExplainerProps`, `NumberedFigureProps`                 | `ArticleProps`, `FigureProps`            | Renamed with their components.                                                                                                                                                                                    |
  | types `TermProps`, `DiagramPartProps`, `FigureReferenceProps` | the same names from `/article`           | Moved. `TermProps` and `DiagramPartProps` add `labels`.                                                                                                                                                           |

  An essay that kept its numbers in React state moves them into `defineLesson`, and its prose reads them through `Param`
  and `Value`.

  ```tsx
  // Before
  import { Explainer, NumberedFigure, Term } from '@mechane-ai/elements/kits/explainers';
  <Explainer figures={['loss']}>
    <NumberedFigure id="loss" caption="Loss by step.">
      <CurveChart {...props} />
    </NumberedFigure>
  </Explainer>;
  // After
  import { Article, Beat, Figure } from '@mechane-ai/elements/article';
  <Article lesson={lesson} locale="en-US" title="Loss by step">
    <Beat id="training">
      <Figure id="loss" caption="Loss by step." description="A falling line.">
        <CurveChart {...props} />
      </Figure>
    </Beat>
  </Article>;
  ```

- **Chart marks carry their record id.** Marks a figure draws now write `data-chart-mark`, and `DotMark`, `BarMark` and
  `SymbolMark` from `/charts/plot` take a `mark` prop. A stylesheet or a script that matched marks by their other
  attributes can match this one. The attribute is added to `BarChart`, `ScatterPlot`, `DotPlot` and `StripPlot` marks
  and to every chart item the `Chart` primitive renders.

### Adopt

- **Six entries.** `/lesson` (`defineLesson`, `Lesson`, `Param`, `Value`, `Playback`, `Transport`, tweens), `/scene`
  (`Scene`, nodes, wires, plane marks, cards, cells, tokens, `SceneFlow`, `MorphScope`), `/article` (`Article`, `Beat`,
  `Figure`, `Scrolly`, `Predict`, `Challenge`, notes, `TeX`), `/mdx` (`Essay`, `essayComponents`), `/lesson/spec`
  (`validateLessonPlan`, `checkLesson`, `explainerGuide`) and `/lesson/agent` (`tutorTools`, `createLearnerTrace`,
  `playTour`).
- **`heatmapColor`** is exported from `/charts/matrix`, so a scene or an application colors a value on a matrix chart's
  scale.
- **Start an essay.** `pnpm exec mechane-elements-catalog --new-essay <directory>` copies an MDX essay starter into a
  new or empty directory.
- **A full example.** `recipes/counting-cards.tsx` (story `Recipes/Counting Cards`) is one essay that uses every layer.
- **Three skills.** `plan-lesson`, `write-explainer` and `review-explainer` ship in the package, and `--install-skills`
  installs them with the others.

## 0.47

Elements has a data display system. Every chart is built from one plot kernel and takes the same figure props. This
release breaks the API of every existing chart. There are no aliases: change each call site.

Elements no longer depends on `@visx/hierarchy`, `@visx/scale` or `@visx/shape`, and no chart uses them. If your app
imports `@visx/*` itself, add it to your own `package.json`: it no longer arrives through Elements. No export moved from
one entry to another in this release. The names that left an entry are listed under "Removed exports".

### Change

- **`locale` is required on every chart.** A number or a date is written from a declared format and the figure's
  `locale`, so a server and a browser render alike. Pass a BCP 47 tag such as `"en-US"`.
- **Formatter functions are gone.** `formatValue`, `formatX`, `formatY`, `formatTick`, `formatTimestamp`,
  `formatChange`, `formatCount`, `formatProbability` and `formatOffset` are replaced by declared formats: `Intl` options
  as a `ValueFormat` or a `TimeFormat` (which names its `timeZone`). A function is still accepted where no option can
  write the text. Ticks use the compact form of the format unless you set `tickFormat`.

  ```tsx
  // Before
  <BarChart formatValue={(value) => `${value.toFixed(1)} ms`} formatTick={(value) => `${value}`} />
  // After
  <BarChart locale="en-US" valueFormat={{ style: 'unit', unit: 'millisecond', maximumFractionDigits: 1 }} />
  ```

- **Selection is `selected` and `onSelectedChange`.** The `selection={{ selectedId, onSelect }}` object is removed, and
  so is the `ChartSelection` type.

  ```tsx
  // Before
  <Histogram selection={{ selectedId, onSelect: (id) => setSelectedId(id) }} />
  // After
  <Histogram selected={selectedId} onSelectedChange={(id) => setSelectedId(id)} />
  ```

- **Heights are named.** `height` takes `'compact'` (160 px), `'regular'` (260 px) or `'tall'` (380 px), not a number.
  `RelationGraph` `width` and `height` stay numbers: they are the extent of your node positions.
- **Limits are objects.** Every `MAX_*` export is removed, as the table under "Removed exports" shows.
- **`description` is a string** on every chart. It was a `ReactNode` on the time-series charts, `BarChart` and
  `FlowDiagram`.
- **Records take an optional `tone`.** An absent tone comes from the enclosing `ToneScope`, then from the record's
  place.
- **Removed exports.** Each name below left the entry shown and has the replacement beside it.

  | Entry               | Removed                                                                                     | Use instead                                                              |
  | ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
  | `/charts`           | type `ChartSelection`                                                                       | `selected` and `onSelectedChange` props, and type `FigureSelectionProps` |
  | `/charts/cartesian` | types `ScatterRangeSelection` and `TimeRangeSelection`                                      | `range`, `onRangeChange` and `rangeStep` props                           |
  | `/charts/cartesian` | `MAX_SCATTER_POINTS`                                                                        | `scatterLimits.points`                                                   |
  | `/charts/matrix`    | `MAX_MATRIX_CELLS`                                                                          | `matrixLimits.cells`                                                     |
  | `/charts/matrix`    | `MAX_HEATMAP_TOKENS`                                                                        | `tokenHeatmapLimits.tokens`                                              |
  | `/charts/graph`     | `MAX_FLOW_NODES` and `MAX_FLOW_LINKS`                                                       | `flowLimits.nodes` and `flowLimits.links`                                |
  | `/charts/graph`     | `MAX_RELATION_NODES`, `MAX_RELATION_EDGES`, `MAX_RELATION_GROUPS`, `MAX_RELATION_DIMENSION` | `relationGraphLimits.nodes`, `.edges`, `.groups` and `.dimension`        |

  `ChartInputError` and `colorTone` were helpers inside the package and were never exported from an entry, so an app
  could not import them. They are gone. A chart now shows an invalid input with `FigureInvalid`, which `/charts/plot`
  exports for a chart you build yourself, and takes a hue from `ToneScope` or a record's `tone`.

#### Migration by chart

| Chart                                               | Before                                                                                              | After                                                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `LineChart`, `AreaChart`                            | `formatTimestamp`, `formatValue`, `formatTick`, `rangeSelection={{ value, onChange, step }}`        | `timeFormat`, `valueFormat`, `tickFormat`, `range`, `onRangeChange`, `rangeStep`, and `locale`                                  |
| `SmallMultiples`                                    | `formatTimestamp` on the group, `formatValue` and `formatTick` per panel                            | `timeFormat` and `locale` on the group, `valueFormat` and `tickFormat` per panel. Panels take no `locale`.                      |
| `Sparkline`                                         | No change                                                                                           | No change                                                                                                                       |
| `BarChart`                                          | `domain` required, `formatValue`, `formatTick`, `highlightedSeriesId`, `selection`, `height` number | `domain` optional (fitted from zero), `valueFormat`, `tickFormat`, `highlighted`, `selected`, `onSelectedChange`, `height` name |
| `BreakdownBar`, `Treemap`                           | `formatValue`, `selection`                                                                          | `valueFormat`, `selected`, `onSelectedChange`. `Treemap` `height` is a name.                                                    |
| `BridgeChart`                                       | `formatValue`, `formatChange`, `formatTick`, `selection`                                            | `valueFormat`, `changeFormat`, `tickFormat`, `selected`, `onSelectedChange`                                                     |
| `ScatterPlot`                                       | `xDomain`, `xLabel`, `formatX`, `yDomain`, `yLabel`, `formatY`, `rangeSelection`                    | `x` and `y` as `PlotAxis`, `range`, `onRangeChange`, `rangeStep={{ x, y }}`. A point `tone` is optional.                        |
| `Histogram`                                         | `domain`, `valueLabel`, `formatValue`, `maximumCount`, `countLabel`, `formatCount`                  | `value` and `count` as `PlotAxis`. The count domain starts at zero and is fitted when absent.                                   |
| `ECDF`                                              | `domain`, `valueLabel`, `formatValue`, `probabilityLabel`, `formatProbability`                      | `value` and `probability` as `PlotAxis`. The probability domain is `[0, 1]` when absent.                                        |
| `IntervalPlot`, `RankedBars`                        | `domain`, `valueLabel`, `formatValue`                                                               | `value` as `PlotAxis`. `intervalLabel` stays on `IntervalPlot`.                                                                 |
| `Matrix`, `TokenHeatmap`                            | `formatValue`, `selection`, required `description` and `emptyLabel`                                 | `valueFormat`, `selected`, `onSelectedChange`. `description` and `emptyLabel` are optional.                                     |
| `ColorLegend`                                       | `formatValue`                                                                                       | `valueFormat` and `locale`                                                                                                      |
| `RelationGraph`                                     | `selection`, required `description` and `emptyLabel`, node `tone` required                          | `selected`, `onSelectedChange`. `description` and `emptyLabel` optional, node `tone` optional.                                  |
| `FlowDiagram`                                       | `formatValue`, `selection`, `height` number                                                         | `valueFormat`, `selected`, `onSelectedChange`, `height` name                                                                    |
| `Waterfall`                                         | `label`, `selectedId`, `onSelect`, `formatOffset`, `emptyLabel` required                            | `title`, `selected`, `onSelectedChange`, `offsetFormat`, `locale`. `emptyLabel` is optional. Item `tone` is optional.           |
| `TimeSeriesChartPlaceholder`, `BarChartPlaceholder` | Frame props without `locale`                                                                        | Same frame props and `locale`. `BarChartPlaceholder` `height` is a name.                                                        |
| `SmallMultiplesPlaceholder`                         | `charts`, `height` number                                                                           | `charts`, `locale`, `height` name                                                                                               |

The most common calls, before and after:

```tsx
// BarChart
<BarChart domain={[0, 100]} formatValue={format} highlightedSeriesId={hovered} selection={{ selectedId, onSelect }} height={200} />
<BarChart locale="en-US" domain={[0, 100]} valueFormat={{ maximumFractionDigits: 1 }} highlighted={hovered} selected={selectedId} onSelectedChange={onSelect} height="regular" />

// LineChart (SmallMultiples panels take valueFormat and tickFormat, the group takes timeFormat)
<LineChart formatTimestamp={formatTime} formatValue={format} rangeSelection={{ value: range, onChange: setRange, step: 60_000 }} />
<LineChart locale="en-US" timeFormat={{ timeZone: 'UTC', timeStyle: 'short' }} valueFormat={{ maximumFractionDigits: 1 }} range={range} onRangeChange={setRange} rangeStep={60_000} />

// ScatterPlot
<ScatterPlot xDomain={[0, 1]} xLabel="Cost" formatX={usd} yDomain={[0, 1]} yLabel="Quality" formatY={percent} rangeSelection={{ value: range, onChange: setRange, xStep: 0.01, yStep: 0.01, locale: 'en-US' }} />
<ScatterPlot locale="en-US" x={{ label: 'Cost (USD)', domain: [0, 1], format: { style: 'currency', currency: 'USD' } }} y={{ label: 'Quality', domain: [0, 1], format: { style: 'percent' } }} range={range} onRangeChange={setRange} rangeStep={{ x: 0.01, y: 0.01 }} />

// Histogram
<Histogram domain={[0, 500]} valueLabel="Latency (ms)" formatValue={ms} maximumCount={400} countLabel="Requests" formatCount={count} />
<Histogram locale="en-US" value={{ label: 'Latency (ms)', domain: [0, 500], format: { maximumFractionDigits: 0 } }} count={{ label: 'Requests', domain: [0, 400], format: { maximumFractionDigits: 0 } }} />

// ECDF
<ECDF domain={[0, 500]} valueLabel="Latency (ms)" formatValue={ms} probabilityLabel="Share" formatProbability={percent} />
<ECDF locale="en-US" value={{ label: 'Latency (ms)', domain: [0, 500], format: { maximumFractionDigits: 0 } }} probability={{ label: 'Share of requests', format: { style: 'percent' } }} />

// IntervalPlot and RankedBars
<RankedBars domain={[0, 1]} valueLabel="Share of errors" formatValue={percent} />
<RankedBars locale="en-US" value={{ label: 'Share of errors', domain: [0, 1], format: { style: 'percent' } }} />

// Matrix and TokenHeatmap
<Matrix valueLabel="Weight" formatValue={weight} selection={{ selectedId, onSelect }} />
<Matrix locale="en-US" valueLabel="Weight" valueFormat={{ maximumFractionDigits: 2 }} selected={selectedId} onSelectedChange={onSelect} />

// Treemap, BreakdownBar and FlowDiagram
<Treemap formatValue={bytes} selection={{ selectedId, onSelect }} height={180} />
<Treemap locale="en-US" valueFormat={{ notation: 'compact' }} selected={selectedId} onSelectedChange={onSelect} height="compact" />

// BridgeChart
<BridgeChart formatValue={usd} formatChange={signedUsd} formatTick={compactUsd} />
<BridgeChart locale="en-US" valueFormat={{ style: 'currency', currency: 'USD' }} changeFormat={{ style: 'currency', currency: 'USD', signDisplay: 'exceptZero' }} />

// Waterfall
<Waterfall label="Request" selectedId={id} onSelect={setId} formatOffset={ms} />
<Waterfall title="Request" locale="en-US" selected={id} onSelectedChange={setId} offsetFormat={{ style: 'unit', unit: 'millisecond' }} />

// RelationGraph (width and height stay numbers)
<RelationGraph title="Dependencies" selection={{ selectedId, onSelect }} width={640} height={360} />
<RelationGraph locale="en-US" title="Dependencies" selected={selectedId} onSelectedChange={onSelect} width={640} height={360} />

// Sparkline: no change
<Sparkline title="Latency" summary="Steady" unit="ms" timestampUnit="seconds" series={series} valueDomain={[0, 300]} />
```

- **`BridgeChart` `changeFormat`** defaults to `valueFormat` with `signDisplay: 'exceptZero'` when `valueFormat` is
  options. When it is a function, the plus and minus prefix logic is unchanged.
- **A `timeFormat` function receives milliseconds**, whichever `timestampUnit` you declare. `timestampUnit` still tells
  the chart whether your timestamps are seconds or milliseconds.

### Behavior to check

- **Default heights changed.** Time-series charts, `BarChart` and `Treemap` default to `compact` (160 px), where they
  were 180, 200 and 180 px. `BridgeChart` defaults to `regular` (260 px), where it was 240 px. Pass `height="regular"`
  to keep a taller plot.
- **States are shared.** Loading shows `FigureLoading` at the chart's height. The time-series charts, `SmallMultiples`
  and `BarChart` keep their placeholders. Empty and invalid input use `FigureEmpty` and `FigureInvalid`.
- **A partial figure says so.** A chart given `coverage` states how much it draws beside its title, and the footnote
  names `source` and `transforms`.
- **Invalid input is refused with a reason.** Axis domains that exclude data, a log axis with zero, and unordered
  records show an invalid figure. Nothing is clamped or reordered.
- **Tick text and legends changed.** Tick text gains precision until neighbours differ, an axis longer than 120 px shows
  at least three ticks, and an axis that draws its title leaves a `style: 'unit'` out of its ticks. A legend that names
  things sits above the plot, and a color or size scale below it.
- **`IntervalPlot` and `RankedBars` write no value beside each row.** The readout and the exact-value table carry the
  exact values. Both take `height` for the room per row.
- **A hollow mark means missing.** A bin, cell or mark with no value is drawn hollow and read as "Unavailable".
- **Hues come from a scope.** A record with no `tone` takes its hue from the enclosing `ToneScope`, then from its place
  in the figure. Pin `tone` where color carries identity.

### Adopt

- **More charts.** 50 charts are registered in all. `/charts/trend` (`CurveChart`, `RunsChart`, `SlopeChart`,
  `BumpChart`, `HorizonChart`), `/charts/comparison` (`DotPlot`, `DumbbellPlot`, `BulletBar`), `/charts/relationship`
  (`ContourPlot`, `ScatterMatrix`, `ParallelCoordinates`, `EmbeddingMap`, `DensityMap`), `/charts/text`, `/charts/image`
  and `/charts/cells`. `BoxPlot`, `ViolinPlot`, `StripPlot` and `Ridgeline` join `/charts/distribution`.
  `ConfusionMatrix`, `CorrelationMatrix`, `AttentionMatrix` and `CalendarHeatmap` join `/charts/matrix`.
  `AttributionGraph` and `TreeDiagram` join `/charts/graph`. `Icicle` joins `/charts/hierarchy` and `EventStrip` joins
  `/charts/timeline`.
- **Newer props.** `valueLabel` titles the value axis of `LineChart`, `AreaChart`, `SmallMultiples` panels, `BarChart`
  and `BridgeChart`. `Sparkline` takes `layout`, matrices take `cellValues`, and `Waterfall` takes `description`,
  `actions`, `source` and `transforms`.
- **Linked figures.** `ToneScope` gives each id one hue in every figure. `ChartLink` and `ChartGrid` share one
  inspection between figures, so hovering a row in one figure marks the same id in the others. `CurveChart` and
  `DotPlot` take `highlighted` and follow the link when it is left out. `useScopedTone` and `useChartLinkControl` let
  prose and diagrams join in. `CurveChart` takes `labels` of `'legend'`, `'inline'` or `'none'`.
- **Statistics as functions.** `/charts/transforms` has bins, densities, fits, quantiles, ranks, smoothing and sampling,
  each with a `describe...` note for the footnote. `bin2d` counts points for `DensityMap`, and its rows count up from
  the lowest `y`.
- **Figure specs.** `/charts/figure` has `FigureSpec`, `validateFigureSpec`, `Figure`, `describeFigure`, `figureCharts`
  and `chartGuide`, so an agent or a server can describe a figure as JSON, check it, draw it and read it back as text.
  `chartGuide` has one entry per registered chart with what it shows and when to use it.
- **The plot kernel.** `/charts/plot` exports the scales, ticks, axes, marks and states that every chart uses, so you
  can build a chart the library lacks.
- **Kits.** `/kits/explainers`, `/kits/training`, `/kits/operations`, `/kits/evaluation` and `/kits/interpretability`
  compose charts into pages.
- **Large point maps.** `EmbeddingMap` draws up to 100,000 points on canvas and 1,000,000 with WebGL.

## 0.46

Every interactive component now runs on a UI SDK primitive. `@base-ui/react`, `@tanstack/react-virtual` and
`@shadcn/react` are no longer dependencies of the package.

### Change

- **`FilePicker` has a new API.** It was a native file input with `onChange`. It now takes
  `onValueChange(files, details)` with `accept`, `multiple`, `maxFiles`, `maxSize` and `minSize`. It lists the chosen
  files and shows why a file was refused.

  ```tsx
  // Before
  <FilePicker onChange={(event) => setFile(event.currentTarget.files?.[0])} />
  // After
  <FilePicker maxSize={32 * 1024 * 1024} onValueChange={(files) => setFile(files[0])} />
  ```

- **`ChartDatumButton` is removed.** Row charts handle their own rows. Pass `selection` to the chart instead.
- **`Accordion.Root` requires `aria-label` or `aria-labelledby`.**
- **`CSPProvider` takes `nonce` and `children` only.**
- **`Waterfall`'s `selectedRef` is `Ref<HTMLDivElement>`** and points at the selected row.
- **Agent names changed.** `navigation-link` is now `link`, and every Elements link reports `href` and `current` and
  offers `follow`. `collection-record` is removed; open a row with `open` on `collection-results`. A chart offers
  `inspect`, `select` and `dismiss`. Update any `allow` function that names the old components or actions.

### Behavior to check

- **One Tab stop per composite.** A table's row actions, the control row above a collection, a timeline's events, a
  waterfall's rows and a row chart with `selection` are each one Tab stop with arrow keys inside. Update tests that
  press Tab once per row.
- `CollectionToolbar` and `FilterChips` have `role="toolbar"` where they had `role="group"`.
- A selectable `DataTable` shows a header checkbox for every supplied row, and Shift with a click selects a range.
- `Waterfall` is a `treegrid`.
- The day pickers show one typed field per date unit instead of the browser's date field.
- `ToggleGroup` sizes to its content instead of stretching across a column.
- On bars and bridge columns the ink edge now means selected only. The band and the readout mark the inspected column.
- A bridge chart leaves out a value label that would touch another label. The value stays in the readout.

### Adopt

- **Change details.** These callbacks gained a second `details` argument with the reason, the source and `cancel()`:
  `Input` and `Textarea` `onValueChange`, a collection's `search.onChange` and `search.onSubmit`, a filter's `onChange`,
  `FilterChips` `onRemove`, a chart's `selection.onSelect`, `Waterfall` `onSelect`, a scatter range's `onChange`, and
  `DataTable` `onSortChange` and `onSelectionChange`. One-argument handlers keep working.
- **`SegmentedControl`** for one choice from a short row. Replace a `ToggleGroup` that forced a single value.
- **`rangeSelection`** on `LineChart` and `AreaChart` for a time range the reader draws, moves and resizes.
- **`history`** on `PromptInput` for Arrow Up recall. Command or Control with Enter always submits.
- New agent components: `message`, `viewer` and `chart-range`.

## 0.29

`ReportSection` is removed. Move its metric summary into the explanatory chart's `report.summary` or
`report.seriesValues`. Use `Stack` when the content already belongs to a region.

# Charts

`@mechane-ai/elements/charts` exports shared frames, legends, selection, and category types. Import plots from
`/charts/cartesian`, `/charts/distribution`, `/charts/matrix`, `/charts/graph`, `/charts/hierarchy`, or
`/charts/timeline`. ScatterPlot belongs to Cartesian, Treemap to hierarchy, and Waterfall to timeline. Import the
package CSS once, as the [component guide](components.md) describes.

Applications own queries, aggregation, ranking, sampling, normalization, and scientific interpretation. Charts own
geometry, inspection, and presentation. A formatter must declare its locale, time zone, precision, and units. Titles and
descriptions explain what was measured and which period or sample is shown.

## Families

| Family         | Components                                      | Use                                                                                     |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Time           | LineChart, AreaChart, Sparkline, SmallMultiples | Recorded trends with elapsed-time spacing and gaps.                                     |
| Categories     | BarChart, BreakdownBar, Treemap                 | Grouped or additive values, proportions, and area allocation.                           |
| Timing         | Waterfall                                       | Known intervals, known instants, and unavailable timing.                                |
| Distributions  | Histogram, ECDF, IntervalPlot, RankedBars       | Prepared bins, cumulative samples, declared intervals, and ordered signed values.       |
| Interpretation | Matrix, TokenHeatmap, ColorLegend               | Indexed values, masks, exact token text, and explicit color domains.                    |
| Coordinates    | ScatterPlot                                     | Supplied coordinates with linked record or rectangular range selection.                 |
| Relationships  | RelationGraph                                   | Positioned nodes, groups, and supplied edges without editing or inferred relationships. |

The public types and synthetic catalog examples are beside each implementation:

- [Cartesian](../packages/browser/elements/packages/charts/src/cartesian/index.ts) and
  [examples](../packages/browser/elements/packages/charts/src/cartesian/cartesian.stories.tsx).
- [Distribution](../packages/browser/elements/packages/charts/src/distribution/index.ts) and
  [examples](../packages/browser/elements/packages/charts/src/distribution/distribution.stories.tsx).
- [Matrix](../packages/browser/elements/packages/charts/src/matrix/index.ts).
- [Hierarchy](../packages/browser/elements/packages/charts/src/hierarchy/index.ts).
- [Relationships](../packages/browser/elements/packages/charts/src/graph/index.ts).
- [Waterfall](../packages/browser/elements/packages/charts/src/timeline/waterfall.tsx).

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
full chart still owns its title and value inspection. ChartFrame supplies title, summary, action and footer layout for a
custom plot. Its renderer composes geometry, legend and inspection. Let one frame own a report's boundary and use Stack
for related sections in page flow. The [composition guide](visual-system.md#composition-decisions) explains table width
and parent layout choices.

SmallMultiples supports simultaneous comparison across the same timestamps, with independent units and populations. Use
a local selector for alternate analytical questions and route navigation for distinct tasks.

## Data and interaction

Time series require finite, strictly increasing timestamps in declared seconds or milliseconds. Every series has one
observation at each timestamp. A missing value is `null`; it creates a visible gap. Stacked observations must be present
and nonnegative. Point annotations identify an existing series, timestamp, and recorded value.

LineChart and AreaChart support pointing, tapping, arrow keys, Home, End, and Escape. One inspected timestamp drives the
guide and readable values. Equivalent observations in new arrays preserve inspection. Changed values, identities, or
markers close it. Inspection stays inside the chart and touch interaction preserves page scrolling.

Use `TimeSeriesChartPlaceholder` for an initially pending LineChart or AreaChart. Use `SmallMultiplesPlaceholder` for
the aligned group so its panel summaries and bottom date axis share the ready layout. Supply the same title, report,
description, series labels, height and heading actions as the loaded chart. Unknown metadata can use SkeletonText.
BarChartPlaceholder uses known series identities when available and a neutral legend skeleton while they are unknown.
Placeholders reserve geometry without observations or interactive controls. The surrounding AsyncRegion owns the busy
state and delayed loading announcement. Keep the real chart mounted during refresh.

Sparkline is a passive 128 × 32 inline trend for a metric row. It requires an application-written `summary`, a value
`unit`, `timestampUnit`, and an explicit `valueDomain`. It shares the time-series validation and line geometry,
including missing gaps and isolated points, but has no focus, hover, or inspection state. Its accessible summary
supplies the meaning of the trend. Use LineChart when the reader needs to inspect individual observations. Empty and
invalid trends retain the compact footprint and state their reason.

SmallMultiples shares the time range, plot gutter and inspected timestamp, with one visible date axis at the bottom.
Each panel owns its value formatter, annotations, period summary and accessible exact values. Latency and cost keep
their different units. All panels supply the same timestamps. Panel identifiers remain stable through updates.

Other families accept an optional `selection` containing `selectedId` and `onSelect`. Omit it for a read-only graphic.
The component reports an identifier; the application owns the linked inspector, URL, or other view. Exact values remain
available through labelled rows or View data. Selection works with keyboard and touch as well as a pointer.

ScatterPlot additionally accepts a controlled range selection. A mouse rectangle and two Base UI sliders report the same
x/y bounds. Touch gestures on the plot preserve page scrolling. A range describes supplied coordinates; it does not
calculate a new embedding or select a dataset outside the supplied window.

## Evidence

BarChart supports pointer, tap, and arrow-key inspection. Home and End reach the boundary categories; Escape dismisses
the readout. An optional controlled selection responds to click or Enter. Category `label` retains the full meaning in
inspection and accessible exact values. The application owns any visible breakdown table. Optional `axisLabel` supplies
a concise tick such as “Oct 6” without changing record identity. Use `formatTick` for compact axes and `formatValue` for
exact inspection and data values. Cartesian charts share an inspector beside desktop marks and a mobile legend with
reserved value space. Keep a composed chart's focused series and independent context in its legend. Supply
`highlightedSeriesId` for temporary emphasis from a linked row. Connect a DataTable through its `onRowHighlightChange`
callback and map its stable row identity to the corresponding series identity. Hover and keyboard inspection leave
activation, selected records and application queries unchanged. Use the table’s `rowAction` and `focusRowId` for
inspection and return focus. The application retains selection and data ownership.

Bar domains include zero. Grouped bars can show signed values; stacked bars require nonnegative observations. Missing
values remain unavailable, and a zero remains a zero. BreakdownBar receives a declared total, shows any unassigned
portion, and tolerates arithmetic rounding without changing the displayed measurements.

Histogram receives bins and counts, including irregular bin widths. ECDF receives prepared cumulative points and draws
steps without estimating a distribution. IntervalPlot draws a bound only when it exists; its interval label states
whether bounds mean a confidence interval, quantiles, or another measure. RankedBars preserves supplied order.

Matrix uses compact square cells. Short glyphs distinguish masked, missing, and unsupplied cells from recorded zero.
Full accessible labels, View data, and the selected-cell inspector retain the exact values and reasons. ColorLegend
shows the declared domain. Diverging scales identify zero even when their bounds are asymmetric. Values outside the
color domain retain their exact text and an explicit status instead of silently saturating the color.

TokenHeatmap preserves supplied indices and exact text, including whitespace. The application supplies the score's
meaning. An attention weight or attribution score is not automatically a causal explanation. Token selection also has
full-sized index controls for whitespace and short tokens.

RelationGraph draws only supplied edges. Node positions, dimensions, and group memberships come from the caller.
Proximity never creates an edge. The canvas can scroll, and native buttons and readable relationships make its records
available without navigating the graphic visually.

## Windows

These components use bounded SVG or native tables. Invalid identifiers, dimensions, domains, or intervals display a
clear error instead of repairing records. Oversized inputs also display an error; they never produce a partial chart
that appears complete. Applications must choose and label a window or an aggregate before rendering it.

The implemented limits live with their owners:

- [Time-series limits](../packages/browser/elements/packages/charts/src/cartesian/time-series-data.ts).
- [Categorical limits](../packages/browser/elements/packages/charts/src/categorical-values.tsx).
- [Distribution limits](../packages/browser/elements/packages/charts/src/distribution/distribution-input.ts).
- [Matrix](../packages/browser/elements/packages/charts/src/matrix/matrix.tsx),
  [tokens](../packages/browser/elements/packages/charts/src/matrix/token-heatmap.tsx), and
  [scatter](../packages/browser/elements/packages/charts/src/cartesian/scatter-plot.tsx) limits.
- [Graph limits](../packages/browser/elements/packages/charts/src/graph/relation-graph.tsx).

The focused `/charts/cartesian` entry exposes `timeSeriesLimits`. `/charts/matrix` and `/charts/graph` expose their
`MAX_*` capacities. Applications can use these values when preparing an explicitly labeled window or aggregate. The
renderer still validates its inputs; these capacities do not authorize silently discarding observations.

Use a table when precise comparison matters more than shape. Dense embeddings or large attribution networks need
measured workloads before adding a Canvas or WebGL renderer. No component fetches data or computes an embedding.

## Appearance

ChartFrame and ChartLegend give custom plots the shared title, description, actions, footer and labeled color roles.
Full chart families include their own frame and legend. Their optional report composition adds a self-contained
boundary, while Sparkline stays inline. The canonical tokens supply light and dark colors. Components measure available
width so responsive plots retain readable labels. Explicit series tones preserve identity across filters; applications
should pin them when colors carry that identity. Use `ChartSeriesMarker` beside a label in a legend or related table
row. Omit artwork for the shared swatch, or supply a 16px decorative icon. Use `Meter layout="inline"` from `/feedback`
for a caller-formatted bounded value and short matching bar in a numeric table cell. The default meter stays stacked.
Unknown or out-of-range values retain their supplied text with an unfilled track; they are never presented as zero or a
clamped percentage. The
[marker examples](../packages/browser/elements/packages/charts/src/chart-series-marker.stories.tsx) and
[measurement examples](../packages/browser/elements/packages/feedback/src/feedback.stories.tsx) show these roles.

The catalog contains synthetic missing, zero, masked, signed, partial, narrow, invalid, and linked-selection examples.
These examples document public behavior. They do not imply that the Mechane API produces every illustrated dataset.

Charts keep their exact-value alternatives static. Use arrow keys in a plot to inspect observations and Enter to
activate supplied selection. Matrix and graph alternatives retain cell states and relationships. A visible breakdown
table is supplied by the application; charts add no data accordion.

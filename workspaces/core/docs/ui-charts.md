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

## Data and interaction

Time series require finite, strictly increasing timestamps in declared seconds or milliseconds. Every series has one
observation at each timestamp. A missing value is `null`; it creates a visible gap. Stacked observations must be present
and nonnegative. Point annotations identify an existing series, timestamp, and recorded value.

LineChart and AreaChart support pointing, tapping, arrow keys, Home, End, and Escape. One inspected timestamp drives the
guide and readable values. Equivalent observations in new arrays preserve inspection. Changed values, identities, or
markers close it. Inspection stays inside the chart and touch interaction preserves page scrolling.

Sparkline is a passive 128 × 32 inline trend for a metric row. It requires an application-written `summary`, a value
`unit`, `timestampUnit`, and an explicit `valueDomain`. It shares the time-series validation and line geometry,
including missing gaps and isolated points, but has no focus, hover, or inspection state. Its accessible summary
supplies the meaning of the trend. Use LineChart when the reader needs to inspect individual observations. Empty and
invalid trends retain the compact footprint and state their reason.

SmallMultiples shares the time range and inspected timestamp. Each panel owns its value formatter and annotations, so
latency and cost can keep their different units. All panels must supply the same timestamps. Panel identifiers remain
stable through updates.

Other families accept an optional `selection` containing `selectedId` and `onSelect`. Omit it for a read-only graphic.
The component reports an identifier; the application owns the linked inspector, URL, or other view. Exact values remain
available through labelled rows or View data. Selection works with keyboard and touch as well as a pointer.

ScatterPlot additionally accepts a controlled range selection. A mouse rectangle and two Base UI sliders report the same
x/y bounds. Touch gestures on the plot preserve page scrolling. A range describes supplied coordinates; it does not
calculate a new embedding or select a dataset outside the supplied window.

## Evidence

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
Full chart families already include their own frame and legend; Sparkline stays inline. The canonical tokens supply
light and dark colors. Components measure available width so responsive plots retain readable labels. Explicit series
tones preserve identity across filters; applications should pin them when colors carry that identity.

The catalog contains synthetic missing, zero, masked, signed, partial, narrow, invalid, and linked-selection examples.
These examples document public behavior. They do not imply that the Mechane API produces every illustrated dataset.

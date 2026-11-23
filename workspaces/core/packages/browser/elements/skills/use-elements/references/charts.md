# Charts

Import shared frames, legends and tones from `@mechane-ai/elements/charts`, and each plot from its own entry. The
application queries, aggregates, ranks and samples. A chart draws supplied measurements and lets a reader inspect them.

## Choose the chart

| The reader asks                              | Use                                             | Entry                                       |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| How did it move over time?                   | `LineChart`, `AreaChart`                        | `/charts/cartesian`                         |
| The same period for several measures         | `SmallMultiples`                                | `/charts/cartesian`                         |
| A trend inside a metric row, not inspectable | `Sparkline`                                     | `/charts/cartesian`                         |
| How do categories compare?                   | `BarChart`, or `RankedBars` in a supplied order | `/charts/cartesian`, `/charts/distribution` |
| What makes up one total?                     | `BreakdownBar`, or `Treemap` for many parts     | `/charts/cartesian`, `/charts/hierarchy`    |
| How did a total become another total?        | `BridgeChart`                                   | `/charts/cartesian`                         |
| Where does an amount flow between stages?    | `FlowDiagram`                                   | `/charts/graph`                             |
| How are values distributed?                  | `Histogram`, `ECDF`, `IntervalPlot`             | `/charts/distribution`                      |
| How do two measures relate per record?       | `ScatterPlot`                                   | `/charts/cartesian`                         |
| A value for every pair of two indexes        | `Matrix`, `TokenHeatmap`, with `ColorLegend`    | `/charts/matrix`                            |
| Which records connect to which?              | `RelationGraph`                                 | `/charts/graph`                             |
| How long did each step take, and when?       | `Waterfall`                                     | `/charts/timeline`                          |

Use a table when exact comparison matters more than shape.

## Supply honest data

- A formatter declares its locale, time zone, precision and unit. Use `formatTick` for compact axes and `formatValue`
  for exact readings.
- A missing value is `null` and draws a gap. A zero is a zero. Never fill a gap to make a line continuous.
- Time series need strictly increasing timestamps, with one observation per series at each timestamp.
- A chart shows an error for invalid or oversized input. It never draws a partial chart that looks complete. Choose and
  label a window or an aggregate first; the entries export their limits, such as `timeSeriesLimits`.
- The title and description say what was measured, and for which period or sample.

## Selection and ranges

Inspection is built in. A plot is one Tab stop. Arrow keys, Home and End move a cursor, the readout shows exact values,
and Escape closes it. Hover and touch do the same. Do not add your own tooltip or key handler.

Pass `selection={{ selectedId, onSelect }}` when a click or Enter should select a record. The chart reports an
identifier and the change details. The app owns the linked inspector, route or filter. Leave `selection` out for a
read-only graphic. On bars, bridge columns and treemap cells the selected mark keeps an ink edge while another mark is
inspected.

`LineChart` and `AreaChart` take `rangeSelection={{ value, onChange, step }}` for a time range the reader draws, moves
and resizes. The range is application state in the axis's own unit. `ScatterPlot` takes a controlled rectangular range.

To link a table and a bar chart, set `BarChart`'s `highlightedSeriesId` from the table's `onRowHighlightChange`.

## Compose a report

Pass `report` when the chart is a self-contained analytical report with a caption, a period summary and the plot. Use
`report.summary` for mixed metrics or `report.seriesValues` for one value per series. Put scoped controls in
`report.actions` with `density="compact"`.

Inside a region that already groups its content, such as an inspector, use the chart without `report`. Use `ChartFrame`
and `ChartLegend` for a custom plot, with `chartToneColors` and `chartToneOutlines` for its marks. Pin a series `tone`
when color carries identity across filters, and reuse it in `ChartSeriesMarker` beside the matching table row.

## Loading

Use `TimeSeriesChartPlaceholder`, `SmallMultiplesPlaceholder` or `BarChartPlaceholder` inside an `AsyncRegion`, with the
same title, report and height as the loaded chart. Keep the real chart mounted during a refresh.

---
name: ui-data-display
message: Build every figure from one kernel, one set of shared props and one meaning per visual channel.
paths: ["packages/browser/elements/packages/charts/**"]
---

## Rules

Build a chart from the plot kernel in `charts/src/plot`: its scales, ticks, paths, axes, marks and surface. A chart owns
its input types, its validation and the arrangement of kernel parts. It does not create another scale, tick, axis or
path implementation. Add to the kernel only what a named chart needs, and add it where the next chart will find it.

Take scales and number steps from the UI SDK number helpers, inspection and selection from the shared `Chart`
primitive, ranges from the SDK spans behavior, grid movement from SDK grid focus, and pan or zoom from the SDK
viewport. Write a plain function with no DOM access only where the SDK has none: ticks, band scales, path geometry,
layouts and hit testing.

Accept `FigureProps` on every chart: title, description, report, actions, locale, source, coverage, transforms, status
and empty label. Name the same thing the same way in every chart. State the application owns arrives as a value with a
change callback that receives the SDK change details: `selected` with `onSelectedChange`, `range` with
`onRangeChange`, `inspected` with `onInspectedChange`. Never add a second spelling for an existing prop.

Write every number through `formatValue` and every instant through `formatTime`, with the figure's `locale` and a
declared format: `Intl` options, or a function where no option can express the text. A time format names its time zone.
Axis ticks use the compact form of the same format. Put the unit in the axis title; an axis that draws its title leaves
a unit style out of its ticks. Every measured axis can show a title, placed by `PlotAxes` with clearance from the ticks
and the plot. The kernel labels ticks: no two ticks of an axis read the same, because tick text gains precision until
they differ, and an axis longer than 120 pixels shows at least three ticks on every scale type.

Give each visual channel one meaning. Hue names a thing. Lightness on one hue is a magnitude. Two hues around a neutral
middle are a signed value around zero. A dashed stroke is modelled: a fit, a projection, a baseline or a target. A pale
band is uncertainty. A hollow mark is missing, masked or excluded. Gray is context, in the kernel's context gray, which
stays visible on a dark surface. Size is a magnitude and needs a legend. Resolve a record's tone through the tone scope,
so one thing keeps one hue across the figures of a page. Draw through the kernel marks, which carry these meanings, and
do not restyle them per chart.

Follow one axis policy. A mark whose length carries an amount starts at zero. A log or symlog axis says so in its
title. A domain the caller leaves out is fitted to round bounds by the kernel. Reject a log axis that would hold zero
or a negative value. Never draw two value scales on one plot.

Follow one gesture grammar. Hover or the arrow keys inspect, a press or Enter selects, a drag draws a range, Escape
dismisses and the plot is one Tab stop. Offer every pointer gesture through the keyboard and to an agent. Pan and zoom
are opt-in and never the default response to a scroll.

Show one frame and one set of states. `FigureFrame` owns the title, description, legends, plot, readout and footnote. A
legend that names things goes to its `seriesLegend` slot above the plot; a legend that explains a color or size scale
goes to its `scaleLegend` slot below it. Category, row, column, layer and node labels use the body face; monospace is
only for token text, code and ids. A label never sits on a mark, a line or another label: it moves to free space through
the kernel's placement helpers, or the lower-priority label is dropped and the readout keeps its value. A label is cut
only when no room is left, and a cut label keeps its full text. `FigureLoading` holds the final geometry, `FigureEmpty`
states that there is nothing to draw, `FigureInvalid` states why the input cannot be drawn, and a figure that draws part
of its data says how much beside its title. The footnote names the source and each transform the application applied.

Keep statistics out of charts. Binning, density estimates, quantiles, fits, smoothing and layouts are named functions
in `charts/src/transforms` that the application calls and can name in `transforms`. A chart draws what it is given.

Declare each chart's accepted size as a named limit and refuse more with an explicit message. Choose the renderer by
that limit: SVG for marks a reader inspects one by one, canvas or WebGL through the kernel renderers for the rest. A
canvas or WebGL plot keeps the same inspection, selection, readout and text alternative as an SVG plot.

Keep every chart describable as data. Props other than callbacks and slots are plain JSON, so the figure spec can name
any chart, `Figure` can draw it and an agent can emit, validate and read it back.

## Checks

Place a changed chart on the figure wall beside the others, in light and dark themes and at phone width. Compare
its frame, axes, ticks, legend, readout, footnote and each state with its neighbors.
Inspect one record by pointer, touch and keyboard and confirm the readout states the supplied values.
Render the chart from its figure spec and confirm the result matches the direct call.
Review a new prop against the names other charts use, and a new kernel part against its first two consumers.

## Local adaptations

Contracts 077, 115 and 118 keep their rules for time series, Waterfall evidence and prepared analytical input. This
contract governs what the chart families share. Where an older rule names a caller-supplied formatter function, a
declared format with the figure's locale satisfies it under contract 072.

The existing time-series and bar placeholders remain the loading state of their charts, because they reserve a legend
and summary that `FigureLoading` does not know. Passive graphics such as `Sparkline` and the table cells keep their
compact frame and take the same formats, tones and channel meanings.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

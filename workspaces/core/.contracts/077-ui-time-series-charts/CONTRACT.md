---
name: ui-time-series-charts
paths: ["packages/browser/elements/packages/charts/src/cartesian/time-series*", "packages/browser/elements/packages/charts/src/cartesian/sparkline.tsx"]
message: Render application-prepared series faithfully and give pointer, touch, and keyboard users the same inspected values.
---

## Rules

Accept finite, strictly increasing timestamps in a declared unit and exactly one value per series per timestamp.
Reject malformed series input instead of repairing it.
Represent a missing observation as an explicit missing value and draw it as a gap, never as an invented or interpolated value.
Require stacked series to supply observed, nonnegative values, and let the application decide when an absent count means zero.
Keep fetching, bucketing, ranking, weighted metrics, and remainder groups in the application; stacking supplied additive values is rendering geometry.
Align every annotation marker with an observation timestamp, and make each point marker reference an existing series and supply its value.

Space observations by elapsed time, not by index.
Start stacked areas at zero, and fit line charts to the observed values, including context series.
Use linear interpolation, and add smoothing, animation, or other scale options only for a stated consumer requirement.
Format timestamps and values with caller-supplied formatters.
Keep supplied partial-period markers visible, including during inspection.
Render a single observation visibly, and show an explicit empty state when no observations exist.

Assign automatic series colors from shared tokens in supplied series order, and let explicit colors consume no automatic slot.
Let the application pin a series color when its identity must persist across filters, ranks, or charts, and render remainder groups in a neutral color.

Give pointer, touch, and keyboard users the same inspected values, including marker descriptions.
Make the plot focusable, with arrow-key and Home and End inspection, a visible focus indicator, and an accessible current value.
Drive the inspection line, values, and annotations from one inspected timestamp.
Show inspection details in one chart-owned surface that consumers do not rebuild.
Expose inspected values as text, not only as graphic marks.
Support touch inspection without blocking scrolling of the surrounding content.
Dismiss inspection details on Escape or an outside press, and keep keyboard focus on the plot after Escape.
Keep a visible cursor at the inspected timestamp after Escape. Resume arrow-key inspection from that timestamp.
Mark only the focused plot's keyboard cursor when small multiples share inspection across panels.
Keep inspection open when equivalent observations arrive in new arrays, and close it when values, series identity, or markers change.
Keep inspection details inside the viewport and in the active theme, and keep series legends visible while idle.

Use SmallMultiples for measures compared on the same observation timestamps. Share the plot gutter and show the
visible date axis beneath the final panel. Keep each panel's value scale, units, sample population and exact-data
action independent. Show one inspection surface at the source panel while the shared timestamp guides all panels.
Keep dates available through every panel's keyboard inspection and Chart data action.

Pass each panel's report summary and metadata into the chart frame. When seriesValues supplies the period summary,
use the supplied series labels and tones once and keep those period values steady during daily inspection.
Use SmallMultiplesPlaceholder with the same known panels, summary shape and height for an initial read.

## Checks

Render examples with a gap, irregular intervals, a single observation, a partial period, and no observations.
Inspect one timestamp by pointer, touch, and keyboard, and confirm the displayed values equal the supplied values.
Replace the data with equivalent arrays and then with changed values, and confirm inspection persists and then closes.
Review consumer projections for units, aggregation, timestamp order, and color identity.
Inspect light and dark themes and a narrow layout with inspection details open.
Compare AlignedReports and AlignedReportsLoading in the Cartesian catalog. Verify one visible date axis, matching
panel geometry, independent value units, and one source-panel inspector with linked guides, including across a gap.

## Local adaptations

This adoption governs the public time-series family. Contract 115 owns Waterfall intervals and contract 118 owns
prepared distributions, matrices, token values, scatter coordinates, and graph relationships.
Timestamp units and value meaning remain explicit in the public inputs and consumer formatters.

The compact inline `Sparkline` in `cartesian/sparkline.tsx` is a passive summary. The inspection, focus, and idle-legend
requirements above apply to interactive charts, not this representation. Sparkline must instead expose the supplied
title, readable summary, value unit and timestamp unit as an accessible image. It adds no focus target, hover inspector
or touch gesture. Use LineChart when a reader needs to inspect individual observations.

For this passive representation, an application-written summary and declared units replace timestamp and value
formatters. An explicit finite, increasing `valueDomain` replaces fitting the vertical scale to observed values, so
metric rows can share a comparable domain. Reject observations outside that domain rather than clipping or expanding
it silently. All input validation, elapsed-time spacing, linear geometry, missing-value gaps, isolated observations,
shared colors, and explicit empty or invalid states remain required.

Review Sparkline's accessible summary and passive behavior alongside its gap, single-point, empty and invalid
examples. Run the pointer, touch, keyboard and inspection-lifecycle checks on the interactive time-series families.

Synthetic catalog examples are supported-library consumers under contract 006. They establish a usable renderer API,
not a historical metrics source in Mechane. A Console integration must map actual recorded data under contract 113.
Source review and temporary pointer, touch, keyboard, and hydration probes establish interaction behavior.
The catalog build establishes compilation only. Test curation still governs retained assertions.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

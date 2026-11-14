---
name: ui-analytical-graphics
message: Render supplied analytical evidence with explicit units, domains, missing values, and inspectable records.
paths: ["packages/browser/elements/packages/charts/**"]
---

## Rules

Accept prepared bins, cumulative points, interval endpoints, matrix values, token scores, coordinates, and relationships.
Keep aggregation, embedding, ranking, normalization, sampling, and causal interpretation with the application.
Stacking supplied additive values and mapping values to screen coordinates are rendering operations.
Reject invalid finite values, inconsistent dimensions, duplicate record identifiers, or impossible intervals through
a clear error state or declared input failure. Do not silently repair, clamp, reorder, or discard evidence.

Require the consumer to declare the meaning of a value, its unit, and its formatter. Keep missing, masked, zero, and
out-of-domain values distinguishable. Show declared sampling, partial coverage, normalization, or truncation alongside
the corresponding graphic. Use a zero baseline for additive magnitude comparisons and a diverging domain for signed
contributions. Display color-domain and interval meaning where a reader needs them to interpret the mark.

Preserve exact token text and its supplied index, including whitespace. Use explicit row and column identities for
matrices and stable record identifiers for scatter and graph selection. Draw only supplied relationships; position or
proximity never implies an edge or causal claim. A read-only graph must not expose editing actions.

Make the selected record and its exact value available as text. Provide keyboard and touch access to the same
information as pointer inspection. Keep selection controlled where an application links a chart to another view.
Use shared color roles, visible focus, and a readable alternative to color alone in both supported themes.
Give an interactive plot one Tab stop and mark its keyboard cursor at a supplied category or timestamp.
Keep cursor movement separate from controlled selection. Activate a linked selection with Enter or Space.
Keep the cursor visible at zero and missing values, after Escape dismisses details, and while equivalent data refreshes.
Use the shared ChartCursor for Cartesian plots. Check its local marker in light, dark, and forced-colors modes.

Bound SVG workloads and document the accepted window. A render limit must produce an explicit unavailable or truncated
state, not a partial graphic that looks complete. Require measured need before adding another rendering engine.

## Checks

Inspect signed values, zero, missing and masked cells, irregular bins, invalid dimensions, exact whitespace tokens,
and empty collections through the public components. Compare graphic geometry and textual evidence with the inputs.

Select the same record with pointer, touch, and keyboard, then replace the supplied selection. Confirm linked views
can preserve identity after record reordering. Check a graph with isolated nodes and verify every edge has an input.

Inspect light and dark themes, narrow layouts, and the declared render limit. Review APIs for hidden analytics or
third-party engine types. Types, existing boundary checks, and focused browser review enforce these requirements;
synthetic catalog documentation does not require a separate assertion suite.

## Local adaptations

BarChart accepts prepared composition buckets alongside ordinary grouped and stacked bars. A parts bucket draws supplied
nonnegative components, a total bucket draws its independent signed value, and a gap omits the account mark. Null component
values remain unavailable. The caller owns reconciliation and the supplied fixed domain. Series focus is independent of
category selection and keeps the independent context visible. Inspect both amounts through the shared inspector and accessible value list.
Use interruptible transform and opacity transitions for series focus under contract 073.

Cartesian charts share chart-owned inspection and accessible exact values. Do not add a default data-dialog
button or hidden interactive controls. The plot owns keyboard selection; its screen-reader alternative is static.
Product reports own useful visible breakdowns; the library does not decide which diagnostic tables belong on a page.
Use a full chart's `report` input for a self-contained analytical report with its title, metadata, period summary and
plot in one subtle frame. Use the ordinary chart when an existing region owns the grouping and separation.
The report frame owns its private compact caption. Its body owns the inset and summary-to-plot spacing.
Independent page and collection sections retain the standard heading role under contract 074.
Related sections can stack. Give each report boundary one owner. Supporting rows can occupy a full-width section.
Supply mixed metrics through `report.summary`. Bar and time-series charts also accept `report.seriesValues`, keyed by
their supplied series identifiers. This summary reuses series labels and tones, and replaces the idle legend.
An undefined series value reserves loading space. Supply explicit text for a known unavailable value.
Keep period summaries stable while inspection shows the selected observation. Give each sample count or scope one owner.
The report and its loading representation share the same frame, title and summary geometry.
An absent, null or false summary reserves no summary spacing.
Use the same report input across the other full graphic families; passive sparklines retain their compact representation.
Keep compact axis formatting separate from the exact inspection formatter. Inspect a parts bucket with its supplied
components, a total-only bucket with its independent total, and a gap with an explicit missing value.
Match a focused chart's legend to its focused series and independent context. Row highlighting changes emphasis only.
Use `ChartSeriesMarker` for a decorative series swatch or icon beside a meaningful label. Supply the same tone in
related marks, legends and rows; keep product identity and palette assignment with the application. Shared chart tones
live in foundations so feedback measurements can use them without depending on the charts family.
Reserve mobile legend value space so inspection does not move the plot or linked rows.
Use the same frame and inspection geometry in the loading representation. BarChartPlaceholder and
TimeSeriesChartPlaceholder accept known labels and dimensions without invented observations. Keep their heading,
responsive legend and plot footprint aligned with the loaded chart; the enclosing async region owns announcements.
When bar-series identity is unknown during the initial read, reserve a neutral responsive legend skeleton.
Keep placeholder slots inert and unlabeled; known series use their actual labels and layout.

Inspect a spike by pointer, keyboard and touch at desktop and phone widths. Confirm that inspection preserves the
controlled selection, activation changes the linked breakdown, Escape dismisses details while preserving plot focus, and the accessible alternative retains exact values. Compare the displayed components with the inputs and check that hovering never fetches data.
Review the containing page or inspector. Does the chosen chart mode have one owner for its visual boundary?

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

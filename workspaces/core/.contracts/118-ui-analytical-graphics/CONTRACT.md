---
name: ui-analytical-graphics
message: Render supplied analytical evidence with explicit units, domains, missing values, and inspectable records.
paths: ["packages/browser/ui/packages/charts/src/cartesian/categorical*","packages/browser/ui/packages/charts/src/distribution/**","packages/browser/ui/packages/charts/src/matrix/**","packages/browser/ui/packages/charts/src/graph/**"]
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

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

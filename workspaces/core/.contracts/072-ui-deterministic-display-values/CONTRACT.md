---
name: ui-deterministic-display-values
paths: ["packages/browser/**/src/**"]
message: Render identical display values from identical inputs everywhere, with explicit locale, time zone, zero, and missing values.
---

## Rules

Identify rendered records by stable record identifiers, never by array position, clock values, or random values; fixed placeholders may use their position.
Generate element identifiers, such as those that link labels or reference graphic resources, with a mechanism that yields the same unique value in every environment that renders the view, and never use them as record identity.
For editable rows without record identifiers, allocate a draft-only identifier when the row is created, keep it through edits and removal, and omit it from transport payloads.
Do not read the current time or random values during render; supply them as inputs.
Sort a copy rather than the supplied collection, and break tied sort values with a stable identifier.

Format every date and number with a locale and time zone supplied as inputs, never with a runtime default that can differ between the environments that render the view, such as a server and a client.
Pass one shared reference time to relative labels and durations, and advance it only through an explicit update.
Reuse an existing formatter only when its locale, time zone, and precision match.

Let shared display components render caller-supplied display values, and keep formatting, units, and rounding with the consumer that owns their meaning.
Render zero as zero, and render missing, unavailable, and hidden values with explicit text instead of zero.
Label every displayed total with the period or scope it covers, and keep that label consistent with the selected period.
Keep each label, its value, and supporting text together in reading order with native semantics.
Let label and value pairs wrap in narrow containers without clipping a value or its unit.

## Checks

Render a changed view twice with the same inputs and reference time, once in each environment that renders it, such as a server and a client, and confirm the outputs match.
Exercise zero, missing, unavailable, tied-sort, and fixed-timestamp inputs, and confirm each renders distinctly and stably.
Review identifier sources, formatter locale and time-zone inputs, and sort ownership in changed code.
Inspect long labels and values in a narrow container for wrapping and clipping.

## Local adaptations

Mechane display formatting belongs to `packages/browser/console-views/src/format.ts` and the resource adapters.
Generic value displays receive strings or explicit formatting callbacks. Keep any declared locale, time zone,
precision, and reference time with that owner, and never rely on a browser or server default.

Presentation collection ordering remains with its application owner under contract 070. The instruction to sort a copy
governs an owner that is allowed to sort; it does not permit generic UI to reorder supplied records.
Contract 113 defines which request timestamps and usage records exist, and contract 115 defines their generic geometry.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

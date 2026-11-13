---
name: ui-waterfall-charts
message: Render interval, point, and unavailable timing evidence without inventing endpoints or hiding its values.
paths: ["packages/browser/elements/packages/charts/src/timeline/waterfall.tsx","packages/browser/elements/packages/charts/src/timeline/waterfall.stories.tsx"]
---

## Rules

Accept explicit interval, point, or unavailable geometry. Draw an interval only from two known endpoints and a point
only from a known instant. An unavailable endpoint must not become zero, the current time, or a fabricated completion.
Use one time domain and scale for every row, and preserve the supplied row order.
Keep record identity stable across refreshes. Receive selection and its callback from the consumer, and report the
selected record without owning navigation or a resource request.

Keep labels, units, formatting, and evidence meaning with the consumer. Keep visx types and geometry inside `ui/charts`.
Make the same values available as readable text. Distinguish unavailable evidence from a zero duration and a point.
Support keyboard selection with an accessible name and visible focus. Keep labels and values readable in narrow layouts.

Use `report` for a standalone analytical section. Its shared ChartFrame owns the visible title, metadata, and supplied
summary above the rows. Keep exact row timing directly available alongside selection. When a row updates another
region, supply its `controls` identifier so the native button exposes that relationship through `aria-controls`.

## Checks

Inspect interval, point, unavailable, zero-duration, overlapping, and long-label stories in the built catalog.
Confirm every row uses the same scale and that missing endpoints never produce a completed bar.
Select a row by keyboard, update selection from its owner, and refresh reordered input with stable identifiers.
Read the same evidence without the graphic, and compare its labels and values with the plotted records.
Inspect the Report story and follow a selected row's controls relationship to its recorded detail.

## Local adaptations

`Waterfall` is the generic renderer. The Mechane request adapter in `console-views` maps recorded timestamps and outcomes
onto its inputs. Contract 113 owns the distinction between reservation-to-settlement and inference time.
Contract 077 owns line and area charts. Their observation model does not replace this interval view's explicit
interval, point, and unavailable evidence.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

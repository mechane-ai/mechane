---
name: ui-waterfall-charts
message: Render interval, point, and unavailable timing evidence without inventing endpoints or hiding its values.
paths: ["packages/browser/ui/src/charts/**"]
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

## Checks

Inspect interval, point, unavailable, zero-duration, overlapping, and long-label stories in the built catalog.
Confirm every row uses the same scale and that missing endpoints never produce a completed bar.
Select a row by keyboard, update selection from its owner, and refresh reordered input with stable identifiers.
Read the same evidence without the graphic, and compare its labels and values with the plotted records.

## Local adaptations

`Waterfall` is the generic renderer. The Mechane request adapter in `console-views` maps recorded timestamps and outcomes
onto its inputs. Contract 113 owns the distinction between reservation-to-settlement and inference time.
Time-series chart requirements are not adopted for this interval view. A separate line or area chart needs its own
actual consumer and data source before that contract is adopted.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

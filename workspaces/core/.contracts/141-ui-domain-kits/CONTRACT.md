---
name: ui-domain-kits
message: Compose a domain kit from the Elements families; a kit adds arrangement and words, never a mark.
paths: ["packages/browser/elements/packages/kits/**"]
---

## Rules

Build a kit component from the Elements families: charts, table cells, collections, layout, forms, overlays, feedback
and content. A kit decides which figures answer a domain question, how they are arranged, which share a tone scope and
linked inspection, and what the words say. It draws no SVG and adds no mark, color, scale, axis or gesture. A figure the
library lacks is added to a chart family under the data display contract and then used.

Import another family only through its public entry file. A name a kit needs and the entry does not export is added
to the entry. A kit never reaches a family's internal file.

Take plain JSON data, callbacks and content slots as props. Every kit component takes `locale` and declared formats
for measured values, never text the application formatted. State the application owns arrives as a value with a
change callback that receives the change details, under the names the chart families use: `selected` with
`onSelectedChange`, `sort` with `onSortChange`, `pinned` with `onPinnedChange`. Keep no state an application or an
agent would need to read or set.

Use one tone scope in a component that shows the same things in more than one figure, and one chart link where the
figures share ids, so a model, run or feature keeps one hue and one hover across the component.

Keep statistics out of kits. The application supplies means, intervals, ranks and deltas, or calls the transforms
itself. A kit may sort or filter what it is given when a prop says so.

Pass loading, empty, partial and invalid input to the figures, or show the shared feedback components. Reject input
that cannot be drawn with a sentence that names the reason. Never repair it.

Take every visible string that is not data from one `labels` prop with plain English defaults. A label says what a
value is and which direction is better. It makes no claim the data does not support.

## Checks

Render each kit component with realistic synthetic data in light and dark themes and at phone width.
Hover one model, run or feature and confirm every figure of the component marks the same one in the same hue.
Render the loading, empty, partial and invalid states and compare them with the same states of a single chart.
Search a changed kit for an SVG element, a color literal and an import of a family's internal file.

## Local adaptations

The explainers kit arranges prose and figures for a reader and owns reading order, numbering and references. Its
components take content slots where the other kits take data.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

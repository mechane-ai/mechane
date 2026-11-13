---
name: ui-data-tables
paths: ["packages/browser/elements/packages/collections/src/data-table*", "packages/browser/console-views/src/**/*.tsx"]
message: Render application-prepared rows as given, and report sorting and paging through controlled values and callbacks.
---

## Rules

Pass a data table rows that the application has already filtered, ordered, projected onto the table's columns, and windowed to the current page.
Give a data table no inputs that process rows, such as a page size, comparator, filter predicate, search text, or data loader; see `ui-presentation-state`.
Use an internal table engine, when there is one, only for its row and column model, and enable none of its sorting, filtering, grouping, or pagination processing.
Define rows, columns, sort values, and pagination values with the table's own presentation types, never with data-access types or the internal table engine's types.

Require a caller-supplied identifier for every row and a unique identifier for every column that stays the same when its header text, position, or visibility changes.
Model sorting as a controlled value naming a column identifier and direction, and show each header's sort state from that value rather than from the last click.
Activate sorting through a button in each sortable header cell, and expose the sort state on that header as `ui-control-accessibility` requires.
Mark a column sortable only when the application's query can order every matching record by it, not just the rows on the current page.
End the application's order for every sortable column with a unique row key, so paging neither repeats nor skips rows whose sort values tie.

Model pagination as controlled values from the application, such as a position label and whether previous and next pages exist, with callbacks that request a move.
Take the availability of previous and next pages from the application's query result, never from the number of supplied rows.
Hold sort and pagination values in the application, and in the URL when they are shareable view state; see `web-url-search-state`.

Give every data table a caption that names its records, either visible or exposed to assistive technology.
Require a caller-supplied empty-state message, so the application can say whether no records exist or none match the current filters.
Show the empty-state message in place of rows when the supplied rows are empty, and leave pending and failed reads to `ui-async-read-states`.

Use a data table to compare several records across shared columns, not to lay out one record's labels and values or to arrange a page.
Build unusual grouped or spanning table structures with semantic HTML instead of adding options for them to the data table.

## Checks

Review the data table's public interface for row-processing inputs, data-access types, and internal table-engine types.
Supply rows in an order that no column defines, and confirm the table renders that order.
Activate a sortable header and a page control with callbacks that do not apply the change, and confirm the rows, header sort state, and page position stay as supplied.
Page through a sorted query whose sort column has tied values, and confirm no row repeats or goes missing.
Render an empty result and inspect the caption, empty-state message, and header sort states in the accessibility tree.
Review changed custom table layouts: do unusual grouped or spanning cells use semantic HTML without adding data-table options?

## Local adaptations

Allow native vertical scroll chaining through every table viewport, including tables with no vertical overflow.
Use content sizing for a finite report breakdown. A primary virtualized collection fills its containing pane.
Give each browsing task one primary collection. Use a separate tab or destination when searching, paging or operating
on another collection forms a distinct task. Related forms, finite breakdowns and selected-record details can stay together.
Different measurement populations require clear scope, and can share a page.
Keep pagination, retry, and load-more controls with their collection.

Use `ReportContent` for an optional inset summary followed by a finite full-width breakdown.
Use `CollectionLayout` for a header above a primary collection viewport filling the available height.
Table cells own their inset within the containing task region. Page tables extend to their section edges, while
dialogs, inspectors and structured message Cards supply their own containing width and scroll boundary.
Keep primary browsing tables outside centered reading columns and padded `PageContent`.
Read-only reference tables that explain nearby prose, such as argument definitions, can remain in the reading column.
Keep page context above the collection. Use `ContentTabs` when choosing one task view at a time is useful.
Supply real destinations and controlled selection for shareable tasks. An isolated dialog, navigation pane, or
inspector owns its own scrolling boundary.

Check real wheel input over rows in both directions with short and overflowing data. A report scrolls through its
table, and a collection scrolls inside its pane. Does the containing task supply one width and inset owner?
Check horizontal overflow and keyboard access at narrow widths.
Inspect the report's last row and its following siblings for another task or collection. The table source's vertical
scroll chaining is reviewed alongside the page compositions and their stories.

`DataTable` is the shared renderer for comparable records, including small finite lists. The library's typed columns
and callbacks hide TanStack implementation types.

Make a row's primary native link or button cover its noninteractive cells. Navigation keeps native middle-click,
modifier-click, context-menu, and keyboard behavior; do not forward row clicks through a synthetic control click.
Keep embedded controls and selection independently operable above that hit area, including focusable timestamps.
Show the row's keyboard focus without moving its geometry, and preserve the primary trigger as the return-focus target.
Inspect a non-primary cell, an embedded control, and keyboard return in the existing Console navigation flow.

Check reusable column metadata against `DataTableColumnLayout` at its definition with an annotation or `satisfies`.
Check complete columns against `DataTableColumn<Row>` there. A later spread or `Object.values` call must not be the
first type check: structural assignment can accept stale extra properties and silently lose their behavior.
TanStack Table supplies the row model; TanStack Virtual may window DOM rows without changing the supplied records.
Neither engine owns the application's query, search, sort, grouping, or page boundaries.

The upstream tied-query pagination check applies to application consumers when a query changes. The generic catalog
checks supplied order and controlled callbacks without inventing a database or retaining a product mock.
Types, source review, and temporary interaction probes verify the table's contract. Existing test-curation rules decide
whether a discovered regression warrants a retained assertion; this adoption adds no test runner.

Require a semantic `role` on every `DataTableColumn`. The table owns matching header and cell alignment and readable
minimum sizing for that role. Applications choose meaning instead of per-column alignment.

| Role                  | Alignment | Sizing                                    |
| --------------------- | --------- | ----------------------------------------- |
| `primary`             | Start     | Flexible record identity                  |
| `text`, `status`      | Start     | Role minimum                              |
| `number`, `timestamp` | End       | Role minimum that keeps the value readable |
| `actions`             | End       | Role minimum that keeps controls operable  |

Primary columns absorb remaining width. Use `text` for identifiers that happen to contain digits, and `number` for
comparable quantities. Add explicit `width` or `shouldTruncate` metadata only for a concrete content need.
An explicit width is a minimum for its header and cells. Pending rows use the same roles and metadata.
Keep readable columns inside the table's named scroll region; narrow screens scroll instead of squeezing words
into a few characters or widening the page. The table owns cell insets from shared `pageGeometry`.
Spanning empty and virtual spacer cells count only columns visible at the current responsive width, including selection.
Use the same responsive condition for that count and column visibility, so empty rows do not introduce extra columns.
Keep empty feedback and its actions within the visible viewport while wide columns scroll. Wrap the message to that
width, including unbroken identifiers. Inspect empty content-sized and fill-height tables before and after horizontal scrolling.

The default row is 48px high, with vertically centered content. Use `rowSizing="content"` when
multiline records or controls cannot fit that height. Never crop an interactive control to preserve row geometry.
The virtualizer's fixed estimate must equal the rendered row height; measure only content-sized rows. Keep row keys,
keyboard navigation, and focused-row retention stable when scrolling. Inspect a long identifier beside a short one,
then scroll beyond the initial viewport and return by keyboard. Placeholders use the same table geometry.

Fixed primary and text cells truncate by default; numbers, timestamps, and actions remain readable.
Compose a primary and secondary text value with `DataTableText`, whose string inputs put ellipsis on the text-bearing
elements. An arbitrary nested layout does not
inherit an ellipsis guarantee from its cell. Preserve the full value in accessible text and a reachable detail or
disclosure. Keep dates, amounts, and comparable numeric values readable with adequate width or explicit content sizing.
Inspect a long composed text cell beside these values; neither a clipped glyph nor a hidden control counts as truncation.

Keep leading artwork nonshrinking and text flexible. Use the same artwork size, fallback and record-identity gap
within a collection and its `DataTableTextPlaceholder`. An absent leading or trailing adornment contributes no empty
slot or gap. Logos and avatars may differ from ordinary glyphs; reserve a missing slot only for a mixed collection
whose labels need that alignment. A table's internal text layout does not redefine the page inset.

Completed collection boundaries are silent by default. An explicit useful summary may remain, but do not show generic
"End of results" messages or reserve an empty footer block after the last row. Preserve loading, retry, and load-more
controls when more records may exist.

Review every changed column's role and any explicit width or truncation choice against its content. Compare headers,
loaded cells, and placeholders at the same width, including long primary text beside numbers, timestamps, and actions.
Confirm reusable column definitions are checked before their first spread or projection, so an unsupported property
fails compilation at its declaration.
At narrow widths, check horizontal keyboard scrolling, independent embedded controls, and one separator above the footer.
At fitting widths, Tab reaches the first table control directly. Keep a named viewport stop when horizontal scrolling
or read-only overflow needs its own keyboard target. Preserve focused rows when a virtualized window changes.
Compare empty, loaded, and windowed tables across the compact breakpoint. Headers must keep the same widths and fill
the table when secondary columns disappear, including after a viewport resize.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

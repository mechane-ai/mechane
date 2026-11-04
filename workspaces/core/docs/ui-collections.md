# Collections and workspaces

Import collection components from `@mechane-ai/elements/collections`, resizing parts from `@mechane-ai/elements/layout`,
and the shared stylesheet once. These components render supplied records and report intent. The application owns
requests, URL state, permissions and persisted preferences.

## Tables

[`DataTable`](../packages/browser/elements/packages/collections/src/data-table.tsx) compares records across named
columns. Supply the already filtered, ordered page, a stable row ID, a caption and an empty-state message. Column IDs
remain stable when labels or visibility change. Each cell receives the caller's record type and can render ordinary
links and controls.

Columns keep a readable minimum width and scroll within the table on narrow screens. A column's optional `width` sets
its minimum in pixels for both the header and cells. Use it when the content needs a wider measure or a compact numeric
column. The scroll region remains keyboard-focusable; horizontal overflow does not widen the page.

Sortable columns require the controlled `sort` and `onSortChange` pair. Clicking a header cycles through ascending,
descending and no sort. Until the application supplies another sort value and row page, the displayed values remain
unchanged. Sort the entire query result before paging, with a unique row key as the final ordering field.

For a plain table, use `satisfies` to check columns while preserving that none declares `sortable: true`:

```tsx
import type { DataTableColumn } from '@mechane-ai/elements/collections';

type Item = { readonly id: string; readonly name: string };

const columns = [{ id: 'name', label: 'Name', cell: (item: Item) => item.name }] satisfies ReadonlyArray<
  DataTableColumn<Item>
>;
```

An explicit `ReadonlyArray<DataTableColumn<Item>>` annotation widens that information and requires the controlled sort
props. `satisfies` retains the precise column choices while checking their supported shape.

Selection requires `selectedIds`, `onSelectionChange` and a label for each row's checkbox. Changes preserve selected IDs
outside the current page. Individual cells can perform actions without turning a table row into a button.

The optional `window` limits mounted rows within the supplied page. It does not fetch more records. The table retains
the focused row and its neighbors while scrolling, exposes logical row positions, and measures the caption and header
before positioning rows. Use the ordinary table for small pages and unusual spanning or grouped structures.

[`CollectionToolbar`, `FilterChips`, `ColumnControls` and `CollectionPagination`](../packages/browser/elements/packages/collections/src/collection-controls.tsx)
compose alongside the table. Pagination receives the result's position text and explicit previous/next availability. It
never guesses whether another page exists from the supplied row count. Column controls report visibility changes; the
application passes the chosen columns back to the table.

Keep toolbar search fields bounded with the Input's placement-only `xstyle`, as the table example does. Actions then
stay on the same row when space allows and wrap below on a phone.

The [table stories](../packages/browser/elements/packages/collections/src/data-table.stories.tsx) demonstrate controlled
selection, application-side sorting, an empty page and a windowed collection.

## Dates

Import date controls from `@mechane-ai/elements/forms/dates`.

[`Calendar`](../packages/browser/elements/packages/forms/src/dates/calendar.tsx) wraps DayPicker's selection and
keyboard navigation. It accepts valid civil dates as `{ year, month, day }`, with one-based months. Supply the locale,
time zone, today and initial month explicitly so server rendering and the browser start from the same inputs.

The calendar converts civil dates to noon in the supplied time zone for DayPicker's date arithmetic. A selection returns
civil dates, not a guessed UTC interval. The application decides how an inclusive date range maps to its API's timestamp
boundaries. A range with `from` and no `to` is an unfinished selection, not a one-day interval.

[`DateRangePicker`](../packages/browser/elements/packages/forms/src/dates/date-range-picker.tsx) adds a Base UI popover,
application-supplied range presets and a clear action. `formatValue` owns the trigger's text. The current time zone
remains visible in the popup. Supply new presets when relative ranges change; the component has no clock.

The initial month starts the calendar's ephemeral navigation state. Use a React key when changing the calendar's
identity should reset that navigation. Changing the time zone resets it automatically.

## Commands

Import command controls and scoped bindings from `@mechane-ai/elements/navigation/commands`.

[`CommandPalette`, `ShortcutHint` and `useCommandShortcuts`](../packages/browser/elements/packages/navigation/src/commands/command.tsx)
use the same application-owned action records. A command supplies its ID, label, eligibility and callback. The palette
uses Base UI's dialog and autocomplete navigation. It does not register keyboard shortcuts by mounting.

Register shortcuts beside their action owner with `useCommandShortcuts`. Supply the smallest element or ref that
contains the action and an explicit `enabled` value. Disable the view's commands while an unrelated modal is open.
Bindings ignore text fields, consumed events and key repeats. Events from a nested modal only reach commands owned
inside that modal. Disabled commands and unmounted owners leave no active registrations.

Define a shortcut once with its logical `key` and modifier flags. `mod` means Command on macOS and Control elsewhere.
`ShortcutHint` derives its platform label from that definition through TanStack Hotkeys. Its server snapshot matches
hydration before the client resolves the actual platform. The palette uses the same hint. Duplicate bindings within a
scope fail instead of running multiple actions; a handled event cannot activate an ancestor's action as well.

Choose bindings that preserve browser and assistive-technology commands. Native typing, list navigation and overlay
dismissal remain owned by the controls. The
[command story](../packages/browser/elements/packages/navigation/src/commands/command.stories.tsx) shows a scoped
palette opener and an unavailable action.

## Resizing

[`Resizable.Root`, `Resizable.Pane` and `Resizable.Handle`](../packages/browser/elements/packages/layout/src/resizable.tsx)
wrap Resizable Panels' pointer and keyboard mechanics. Give panes stable IDs and explicit percentage limits. The handle
requires an accessible label describing the regions it separates.

`initialSizes` and `initialSizePercent` initialize the interaction. `onSizesChange` reports user-driven changes for
application-owned persistence. The component writes no browser storage. To restore a different saved layout, change the
layout's React key with its initial values. The
[resizing story](../packages/browser/elements/packages/layout/src/resizable.stories.tsx) shows a source pane and
inspector that stay mounted throughout the gesture.

# Collections and workspaces

Import collection components from `@mechane-ai/elements/collections`, resizing parts from `@mechane-ai/elements/layout`,
and the shared stylesheet once. These components render supplied records and report intent. The application owns
requests, URL state, permissions and persisted preferences.

## Tables

Choose the [containing task region](visual-system.md#composition-decisions) before the table's viewport. Use
`PageSection` for an optional inset summary followed by full-width finite report rows. Pass content directly to its
summary slot. A table-only section omits that slot. Use `CollectionLayout` for one primary collection whose header stays
above a viewport filling the available height.

Table cells own their inset within that region. A report chart can be inset while the breakdown reaches the section
edges. Dialogs, inspectors and structured message Cards have their own containing width. Keep collection controls and
pagination with their rows. Related report sections can remain stacked in page flow. Read-only reference tables
explaining nearby prose can use its reading column. Give an independent browsing or operational task its own destination
when that task needs separate search, paging or recovery. Related forms, finite breakdowns and selected-record details
can share a view.

[`DataTable`](../packages/browser/elements/packages/collections/src/data-table.tsx) compares records across named
columns. Supply a stable row ID, caption, empty state, and a `query` describing search and filter behavior. Local and
controlled queries render the shared controls. Choose ownership according to where the complete result is available.

| Query mode   | Use                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `local`      | Supply the complete rows, a searchable string accessor and filter dimensions. Elements derives choices, filters rows and then applies windowing.                         |
| `controlled` | Supply current search and filter controls with change callbacks. The application queries the entire result and resets paging when criteria change.                       |
| `frame`      | A surrounding `TableQueryFrame` declares the search and filters provided by a shared page header. Pass its filtered state so the table can show a filtered empty result. |
| `static`     | Give a concrete `reason` for a fixed display, such as a short argument reference embedded in prose.                                                                      |

For example, a local project collection can declare its query alongside the columns:

```tsx
<DataTable
  caption="Projects"
  columns={columns}
  rows={projects}
  getRowId={(project) => project.id}
  empty="No projects."
  query={{
    mode: 'local',
    search: (project) => project.name,
    filters: [{ id: 'status', label: 'Status', value: (project) => project.status }],
  }}
/>
```

To omit only search or only filtering, replace that capability with `{ reason: '…' }` and explain the specific reason.
If several views share controls, mount them in their existing header and use `TableQueryFrame` to declare their scope.
`useLocalTableQuery` exposes filtered rows and the matching controls for a complete local dataset. Local pagination
slices those filtered rows; server pagination sends criteria to the source and uses `controlled` or a controlled frame.
A nested independent collection starts its own query. `filteredEmpty` can offer a way to clear criteria when rows exist
but none match. UI SDK exposes the collection's query and filter choices through its `collection-query` primitive.

Column IDs remain stable when labels or visibility change. Each cell receives the caller's record type and can render
ordinary links and controls.

Columns keep a readable minimum width and scroll within the table on narrow screens. A column's optional `width` sets
its minimum in pixels for both the header and cells. Use it when the content needs a wider measure or a compact numeric
column. An overflowing viewport has a named keyboard scroll target. Horizontal overflow stays within the table.

Sortable columns require the controlled `sort` and `onSortChange` pair. Clicking a header cycles through ascending,
descending and no sort. Until the application supplies another sort value and row page, the displayed values remain
unchanged. Sort the entire query result before paging, with a unique row key as the final ordering field.

For a table with unsortable columns, use `satisfies` to check columns while preserving that none declares
`canSort: true`:

```tsx
import type { DataTableColumn } from '@mechane-ai/elements/collections';

type Item = { readonly id: string; readonly name: string };

const columns = [
  { id: 'name', label: 'Name', role: 'primary', cell: (item: Item) => item.name },
] satisfies ReadonlyArray<DataTableColumn<Item>>;
```

An explicit `ReadonlyArray<DataTableColumn<Item>>` annotation widens that information and requires the controlled sort
props. `satisfies` retains the precise column choices while checking their supported shape.

Check metadata shared by loaded and placeholder rows against `DataTableColumnLayout` at its definition. For a named
column map, use `satisfies Record<string, DataTableColumnLayout>` before spreading a column or calling `Object.values`.
Checking only the final array can silently accept obsolete properties inherited through those intermediate values.

Selection requires `selectedIds`, `onSelectionChange` and a label for each row's checkbox. Changes preserve selected IDs
outside the current page. Shift and a click select the range from the row chosen before, and the header checkbox selects
every supplied row. Individual cells can perform actions without turning a table row into a button.

Use `rowAction` for an inspectable record. Its first visible cell contains a real link when `href` is supplied, or a
button for a local action. Modified link clicks retain normal browser behavior. Other cell controls keep their own
actions, and text selection does not open the record. The record actions share one Tab stop on the UI SDK grid focus.
Arrow keys move by a row, Page Up and Page Down by ten, and Home and End reach the first and last supplied row. The UI
SDK virtualizer windows long tables, and the Tab stop's row stays mounted. `activeRowId` marks the inspected record
without changing selection. `onSortChange` and `onSelectionChange` receive the UI SDK change details after the value. An
agent reads the rows as items of `collection-results` and uses its `sort`, `select`, `open`, `previousPage` and
`nextPage` actions.

Mark columns `isSecondary` to hide them at the compact table breakpoint. `shouldTruncate` clips a cell within its
column; the full value should remain available through the record view. `hideCaption` and `hideHeaders` keep their
semantic labels available to assistive technology.

The optional `window` limits mounted rows within the supplied page. It does not fetch more records. The table retains
the focused row and its neighbors while scrolling, exposes logical row positions, and measures the caption and header
before positioning rows. Omit `window` for small pages. Use a native table for unusual spanning or grouped structures.

Set `window.height` to a pixel limit or `'fill'` inside a flex column with bounded height. `endContent` stays inside the
scroll region; `footer` stays outside it. Supply `onEndReached` only while another page is eligible to load.
`CollectionEnd` exposes ready, loading, retry, and complete states, including a manual load action. It never infers
completion from an empty page. `CollectionScroll` supplies the same boundary for non-tabular content.

[`CollectionToolbar`, `FilterChips`, `DisplayOptions` and `CollectionPagination`](../packages/browser/elements/packages/collections/src/collection-controls.tsx)
compose alongside the table. Pagination receives the result's position text and explicit previous/next availability. It
never guesses whether another page exists from the supplied row count. Display options use the shared icon trigger and
report changes to supplied choices. Required choices remain disabled; the application supplies reset behavior and passes
the chosen columns back to the table. The same control supports non-column display choices.

Keep toolbar search fields bounded with the Input's placement-only `xstyle`, as the table example does. Actions then
stay on the same row when space allows and wrap below on a phone.

The [table stories](../packages/browser/elements/packages/collections/src/data-table.stories.tsx) demonstrate controlled
selection, application-side sorting, an empty page and a windowed collection.

## Dates

Import date controls from `@mechane-ai/elements/forms/dates`.

[`Calendar`](../packages/browser/elements/packages/forms/src/dates/calendar.tsx) uses UI SDK Calendar for selection and
keyboard navigation. It accepts civil dates as `{ year, month, day }` with one-based months. Supply the locale, time
zone, today and initial month explicitly. A range with `from` and no `to` is an unfinished selection. The application
converts inclusive dates to its API's timestamp boundaries.

[`DateRangePicker`](../packages/browser/elements/packages/forms/src/dates/date-range-picker.tsx) composes the shared
popover, calendar and application-supplied range presets. See
[date controls](ui-controls.md#dates-and-reporting-periods) for the draft, commit and formatting rules.

## Commands

Import command controls and scoped bindings from `@mechane-ai/elements/navigation/commands`.

[`CommandPalette`, `ShortcutHint` and `useCommandShortcuts`](../packages/browser/elements/packages/navigation/src/commands/command.tsx)
use the same application-owned action records. A command supplies its ID, label, eligibility and callback. The palette
composes the shared dialog and UI SDK Command. It does not register keyboard shortcuts by mounting.

Register shortcuts beside their action owner with `useCommandShortcuts`. Supply the smallest element or ref that
contains the action and an explicit `isEnabled` value. Disable the view's commands while an unrelated modal is open.
Bindings ignore text fields, consumed events and key repeats. Events from a nested modal only reach commands owned
inside that modal. Disabled commands and unmounted owners leave no active registrations.

Define a shortcut once with its logical `key` and modifier flags. `mod` means Command on macOS and Control elsewhere.
`ShortcutHint` derives its platform label from that definition through UI SDK shortcuts. Its server snapshot matches
hydration before the client resolves the actual platform. The palette uses the same hint. Give each shortcut one
eligible owner in its scope. A handled event stops before an ancestor can act on it.

Choose bindings that preserve browser and assistive-technology commands. Native typing, list navigation and overlay
dismissal remain owned by the controls. The
[command story](../packages/browser/elements/packages/navigation/src/commands/command.stories.tsx) shows a scoped
palette opener and an unavailable action.

## Resizing

[`Resizable.Root`, `Resizable.Pane` and `Resizable.Handle`](../packages/browser/elements/packages/layout/src/resizable.tsx)
wrap UI SDK Resizable for pointer and keyboard resizing. Give panes stable IDs and explicit percentage limits. The
handle requires an accessible label describing the regions it separates.

`initialSizes` and `initialSizePercent` initialize the interaction. `onSizesChange` reports user-driven changes for
application-owned persistence. The component writes no browser storage. To restore a different saved layout, change the
layout's React key with its initial values. The
[resizing story](../packages/browser/elements/packages/layout/src/resizable.stories.tsx) shows a source pane and
inspector that stay mounted throughout the gesture.

## Collection interactions

Use `useCollectionControls` from `/collections` for search, filter picking, applied chips and focus restoration. Supply
current values and callbacks; the hook does not fetch, filter records or write URL state. Option icons are supplied
React content. It returns `actions`, `chips`, local `onKeyDown` handling and `openSearch`.

Place actions in the existing page or section header, or beside PageNavigation when that row owns the view controls.
Place active chips below it through CollectionToolbar. Keep the title, navigation and row layout with their existing
owners. The Collection interactions catalog demonstrates this composition and its pending and failed states.

The actions are one UI SDK toolbar: Tab enters once, the arrow keys move between find, filters and display, and the
search field releases the arrows only from the end of its text. `CollectionToolbar` and `FilterChips` are toolbars too.
Chips and actions placed inside a CollectionToolbar become groups of it, so the whole control row keeps one Tab stop.

Applications can register `openSearch` through `useCommandShortcuts` with an explicit focus region and eligibility. The
collection hook adds no global shortcut or fixed shortcut hint. Text entry, native document find and modal focus retain
their normal behavior.

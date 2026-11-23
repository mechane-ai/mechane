# Tables and collections

Import from `@mechane-ai/elements/collections`. The components render supplied records and report intent. The
application owns requests, URL state, permissions and saved preferences.

## Declare the query

Every `DataTable` takes a stable `getRowId`, a `caption`, an `empty` state and a `query`.

| Query mode   | Use it when                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `local`      | The app holds every row. Supply a search accessor and filter dimensions; the table filters and windows. |
| `controlled` | A server pages the rows. Supply search and filter values with callbacks, and reset the page on change.  |
| `frame`      | A shared header already holds the controls. Declare them once with `TableQueryFrame`.                   |
| `static`     | The table is a fixed reference. Give a concrete `reason`.                                               |

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

To leave out only search or only filters, replace that capability with `{ reason: '…' }`. For a paged source, apply
search, filters and sort to the whole result before the server takes a page, with a unique key as the last sort field.

## Columns

Each column declares a `role`: `primary`, `text`, `status`, `number`, `timestamp` or `actions`. The role owns alignment
and minimum width, and the primary column takes the remaining space. Check the array with `satisfies`:

```tsx
const columns = [
  { id: 'name', label: 'Name', role: 'primary', cell: (item: Item) => item.name },
] satisfies ReadonlyArray<DataTableColumn<Item>>;
```

An explicit type annotation widens the columns and then requires the controlled sort props. A column with
`canSort: true` needs the `sort` and `onSortChange` pair, and the app sorts the rows.

- Rows are 48px and text truncates. Set `rowSizing="content"` for records that need several lines.
- Use `DataTableText` for a primary string with an optional second line.
- Mark a column `isSecondary` to hide it at the compact breakpoint.
- The table owns its cell insets. Keep a full-width table outside `PageContent`, or use `PageSection`'s `breakdown`.

## Opening, selecting and paging

- `rowAction` makes a record inspectable. Supply `href` for a real link, or a callback for a local action. Other cell
  controls keep their own actions. `activeRowId` marks the inspected record without changing selection.
- Selection needs `selectedIds`, `onSelectionChange` and a label for each row's checkbox. Shift and a click select a
  range, and the header checkbox selects every supplied row.
- `CollectionPagination` takes the position text and explicit previous and next availability. Never infer another page
  from the row count.
- `window` limits the mounted rows of a long page. It does not fetch. Use `CollectionEnd` for loading more, with its
  ready, loading, retry and complete states.
- Pass `resultStatus` while a read is pending or failed, and keep the previous rows on screen.

## The control row

A local or controlled query renders its own search and filters. For a custom header, call `useCollectionControls` with
the current values and callbacks. It returns `actions`, `chips`, `onKeyDown` and `openSearch`. Put the actions in the
page or section header and the chips below them in a `CollectionToolbar`.

The control row is one toolbar. Tab enters it once, and the arrow keys move between chips, find, filters and display
options. The search field releases the arrows only from the end of its text. Do not add a second Tab stop or a custom
key handler around it.

## What the keyboard does

- The row actions of a table share one Tab stop. Arrow keys move by a row, Page Up and Page Down by ten, and Home and
  End reach the first and last supplied row.
- `Timeline` events share one Tab stop, and arrow keys move between them. Links inside an event keep their own stops.
- Register a shortcut with `useCommandShortcuts` from `/navigation/commands`, beside the action's owner, with an
  explicit `isEnabled`. `CommandPalette` lists the same action records and registers nothing by mounting.

## A selected record

`Inspector` puts a list in `master` and the selected record in `detail`, side by side when there is room and stacked in
a narrow container. Change `revealKey` when the selection changes so a stacked detail scrolls into view. `Details`
renders labeled fields. `Metric` and `MetricGrid` summarize a record or a period; pass `isLoading` to reserve their
space. `Timestamp` takes an ISO datetime and a label the app formatted with an explicit locale and time zone.

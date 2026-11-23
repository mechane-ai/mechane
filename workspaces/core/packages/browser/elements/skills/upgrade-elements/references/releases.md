# Release notes for applications

Newest first. Each section lists what an application must change, then what it may adopt.

## 0.46

Every interactive component now runs on a UI SDK primitive. `@base-ui/react`, `@tanstack/react-virtual` and
`@shadcn/react` are no longer dependencies of the package.

### Change

- **`FilePicker` has a new API.** It was a native file input with `onChange`. It now takes
  `onValueChange(files, details)` with `accept`, `multiple`, `maxFiles`, `maxSize` and `minSize`. It lists the chosen
  files and shows why a file was refused.

  ```tsx
  // Before
  <FilePicker onChange={(event) => setFile(event.currentTarget.files?.[0])} />
  // After
  <FilePicker maxSize={32 * 1024 * 1024} onValueChange={(files) => setFile(files[0])} />
  ```

- **`ChartDatumButton` is removed.** Row charts handle their own rows. Pass `selection` to the chart instead.
- **`Accordion.Root` requires `aria-label` or `aria-labelledby`.**
- **`CSPProvider` takes `nonce` and `children` only.**
- **`Waterfall`'s `selectedRef` is `Ref<HTMLDivElement>`** and points at the selected row.
- **Agent names changed.** `navigation-link` is now `link`, and every Elements link reports `href` and `current` and
  offers `follow`. `collection-record` is removed; open a row with `open` on `collection-results`. A chart offers
  `inspect`, `select` and `dismiss`. Update any `allow` function that names the old components or actions.

### Behavior to check

- **One Tab stop per composite.** A table's row actions, the control row above a collection, a timeline's events, a
  waterfall's rows and a row chart with `selection` are each one Tab stop with arrow keys inside. Update tests that
  press Tab once per row.
- `CollectionToolbar` and `FilterChips` have `role="toolbar"` where they had `role="group"`.
- A selectable `DataTable` shows a header checkbox for every supplied row, and Shift with a click selects a range.
- `Waterfall` is a `treegrid`.
- The day pickers show one typed field per date unit instead of the browser's date field.
- `ToggleGroup` sizes to its content instead of stretching across a column.
- On bars and bridge columns the ink edge now means selected only. The band and the readout mark the inspected column.
- A bridge chart leaves out a value label that would touch another label. The value stays in the readout.

### Adopt

- **Change details.** These callbacks gained a second `details` argument with the reason, the source and `cancel()`:
  `Input` and `Textarea` `onValueChange`, a collection's `search.onChange` and `search.onSubmit`, a filter's `onChange`,
  `FilterChips` `onRemove`, a chart's `selection.onSelect`, `Waterfall` `onSelect`, a scatter range's `onChange`, and
  `DataTable` `onSortChange` and `onSelectionChange`. One-argument handlers keep working.
- **`SegmentedControl`** for one choice from a short row. Replace a `ToggleGroup` that forced a single value.
- **`rangeSelection`** on `LineChart` and `AreaChart` for a time range the reader draws, moves and resizes.
- **`history`** on `PromptInput` for Arrow Up recall. Command or Control with Enter always submits.
- New agent components: `message`, `viewer` and `chart-range`.

## 0.29

`ReportSection` is removed. Move its metric summary into the explanatory chart's `report.summary` or
`report.seriesValues`. Use `Stack` when the content already belongs to a region.

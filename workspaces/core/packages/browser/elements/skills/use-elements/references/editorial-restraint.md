# Editorial restraint & Lego-block defaults

Elements apps are calm, hairline-divided analytical workspaces—not card grids or prose-heavy dashboards.

## One page, one question

- Give every route a single job.
- **Overview** answers _"Where do things stand?"_ with one flat `MetricGrid` and one primary visual (fitting cleanly on
  a single desktop viewport). Move deep attribution charts, comparison tables, and logs onto dedicated routes or
  `PageLayout.navigation` tabs.
- Prefer smaller, click-through pages and right-hand `Workbench` / `Drawer` inspectors over vertical stacks of four or
  more charts.

## Zero-card default

- Place `MetricGrid`, charts, and Markdown directly inside `PageSection` (which supplies the standard gutter
  automatically).
- Place tabular lists edge-to-edge using `CollectionPage` or `PageSection.breakdown`.
- Do **not** wrap metric strips, tables, list items, or documentation in bordered `Panel` cards. Hairline dividers and
  consistent gutters already separate sections cleanly.

## Zero-slop copy budget

- Omit chart `description` unless it communicates non-obvious data provenance (sample window, split, or filter). Never
  write UI instructions (`"Hover to inspect..."`, `"Click any cell..."`, `"Check rows to filter"`) or restate what the
  title, axes, and legend already show (`"Dashed curve marks..."`, `"Higher is better..."`).
- Keep table rows scannable: concise single-line primary labels, short badge tokens, and tabular numbers. Put long prose
  and raw metadata in the click-through inspector pane or drawer.
- Never show raw backend slugs (`w5_v3_d1536_t115...`) in primary labels; map them to short human labels and keep the
  raw identifier in the inspector with `CopyValue`.

## Shell & collection Lego blocks

- **Area-forking rail:** Put top-level areas in `AppShell.rail` and Settings/account controls in `AppShell.railFooter`.
  Swap `AppShell.sidebar` to show only the active area's pages—never duplicate every page on both the rail and sidebar.
- **No sync/status clutter:** Use silent background polling for live telemetry; omit manual `Sync` / `Refresh` buttons
  and footer timestamp pills from primary pages. Keep theme and environment controls under Settings.
- **Use `CollectionPage` for tables:** One component gives you `PageLayout`, top-bar `Find in view` & `Filters` (`/` and
  `⌘F`), `CollectionToolbar` filter chips, full-width `DataTable`, and an optional resizable `Workbench` inspector.
  Never hand-wire search inputs or filter dropdowns in the page body.

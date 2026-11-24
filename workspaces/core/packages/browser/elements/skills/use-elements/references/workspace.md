# Workspace layout

Mount one `AppShell` around the router outlet. `AppShell` locks the viewport at `100dvh` with an independent scrolling
`<main>` column so the rail and sidebar stay pinned without custom CSS. Put top-level areas in `rail`, swap `sidebar` to
show only the active area's pages, and put Settings/account controls in `railFooter`. On a phone use the shell's drawer
and its navigation callback.

Use `PageSection` for report sections: both `summary` and `children` receive the standard inset gutter automatically
(without double-padding if wrapped in `PageContent`), while `breakdown` renders edge-to-edge full width for a
`DataTable`. Use `DetailPage isWide` for a wide standalone working surface (it keeps the standard inset gutter by
default; pass `isBleed` only for an intentional zero-gutter canvas). Constrain prose and individual forms locally. Keep
a wide plot's horizontal scroll inside its figure. At a wide desktop viewport, compare the right edge of a report header
with its table and the edge of the pane.

Use `CollectionPage` from `/kits/research` for full-width searchable/filterable table pages. It wires `PageLayout`,
top-bar search & filter controls (`/` and `⌘F`), `CollectionToolbar` filter chips, full-width `DataTable`, and an
optional resizable `Workbench` inspector in one component. Never put inline search inputs or filter dropdowns in the
page body.

Use `SegmentedControl` from `/forms` to switch between a few views; one item is always checked. Use `ToggleGroup` for
independent pressed choices. Both size to their content. Put either beside an Elements field and select, compare their
outer heights with a fine pointer and a coarse pointer, and check wrapping at phone width.

Use the shell's `railFooter.navigation` and `railFooter.menu` for persistent settings and account controls. Let the
shell space and position both groups. Put route tabs and their actions in `PageLayout.navigation`. Wrap each report
heading and its content in a sibling `PageSection` so scrolling advances the sticky heading while preserving the page
toolbar.

Give every table a query. Use local search and filter dimensions for complete finite data. Route remote search and
filters through the collection owner before the server takes a page. A table inside its collection's query frame reuses
the same controls. Record a specific reason for a static reference table or an unavailable capability.

Use `EventMonth` from `/forms/dates` for an event grid. Supply display labels per civil date and handle the selected day
in the caller. Use the grid across the working pane and show the selected day's actions and full agenda separately.

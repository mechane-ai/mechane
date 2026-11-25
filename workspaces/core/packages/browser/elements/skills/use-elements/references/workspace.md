# Workspace layout

Mount one `AppShell` around the router outlet. `AppShell` locks the viewport at `100dvh` with an independent scrolling
`<main>` column so the rail and sidebar stay pinned without custom CSS. Put top-level areas in `rail`, swap `sidebar` to
show only the active area's pages, and put Settings/account controls in `railFooter`. On a phone use the shell's drawer
and its navigation callback.

Place workspace-wide bottom controls in `AppShell.bottomBar`. The row takes its content's actual height, including the
bottom safe area. Nested pages fill the remaining space. Bottom toasts clear the row even when its height changes. For
DevTools, call `useDevToolsBar` once in the signed-in shell with an app-specific local storage key and pass
`isVisible ? <DevToolsBar /> : null` to the slot. The shortcut is Command–Option–Shift–Backslash. The bar uses the
toolbar height by default. Set `--mechane-devtools-bar-height` on the shell's ancestor to change its minimum height.

Compose `PageSection` directly inside `PageLayout`. Its `summary` and `children` slots supply the standard inset gutter,
and `breakdown` spans the pane for a `DataTable` or `EventMonth`. The `calendar-workspace` recipe uses the grid as a
breakdown and shows the selected day's full event names in the inset body of a sibling section. `PageContent` inside an
already inset slot adds no second gutter.

Use `DetailPage isWide` for a wide standalone working surface with the standard inset. Use `isBleed` when the entire
detail fills the pane. Constrain prose and individual forms locally. Keep a wide plot's horizontal scroll inside its
figure. At a wide desktop viewport, compare the right edge of a report header with its table and the edge of the pane.

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

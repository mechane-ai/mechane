# Workspace layout

Mount one `AppShell` around the authenticated router outlet. Keep its rail, secondary pane, collapse state and toolbar
in the same positions across destinations. Change the selected link and the secondary links for the active workspace. A
workspace with one page can name that page in the pane. On a phone use the shell's drawer and its navigation callback.

Use `DetailPage isWide` for a working surface such as a ledger, calendar, or chart dashboard. Give the pane one
responsive gutter. Constrain prose and individual forms locally. Keep a wide plot's horizontal scroll inside its figure.
At a wide desktop viewport, compare the right edge of a report header with its table and the edge of the pane.

Give repeatable tasks such as reviewing a queue a named navigation link with deep-link and Back support. Put filters in
the toolbar. Keep drill-down on the data mark or row it explains.

Use `ToggleGroup` from `/forms` for short sets of pressed choices. For a required selection, keep the active value when
pressing the selected item returns an empty array. Put the group beside a native Elements field and select. Compare
their outer heights with a fine pointer and a coarse pointer, and check wrapping at phone width.

Use the shell's `railFooter.navigation` and `railFooter.menu` for persistent settings and account controls. Let the
shell space and position both groups. Put route tabs and their actions in `PageLayout.navigation`. Wrap each report
heading and its content in a sibling `PageSection` so scrolling advances the sticky heading while preserving the page
toolbar.

Give every table a query. Use local search and filter dimensions for complete finite data. Route remote search and
filters through the collection owner before the server takes a page. A table inside its collection's query frame reuses
the same controls. Record a specific reason for a static reference table or an unavailable capability.

Use `EventMonth` from `/forms/dates` for an event grid. Supply display labels per civil date and handle the selected day
in the caller. Use the grid across the working pane and show the selected day's actions and full agenda separately.

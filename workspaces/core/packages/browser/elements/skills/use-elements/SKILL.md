---
name: use-elements
description:
  Build React pages with Mechane Elements. Find the page recipe, public imports, and Storybook example for a collection,
  report, tabbed workspace, or form.
---

# Build with Elements

From the app with `@mechane-ai/elements` installed, look up the user’s task:

```sh
pnpm exec mechane-elements-catalog "searchable table with filters"
```

Start with the matching recipe. Read its TSX for the full component composition and its public imports. The same example
runs in the Elements Storybook under **Recipes**. The command uses the installed package. The machine-readable index is
also available at `@mechane-ai/elements/catalog.json`.

Load `@mechane-ai/elements/styles.css` once at the app entry. Choose the owning family for each import. Keep route
state, authorized data, and mutations in the application.

- **Searchable collection.** Use local query mode for a complete finite collection. For a paged source, send search and
  filters to the data owner before it takes a page. Keep the query and current page together in route state when users
  need to return to the same results.
- **Sectioned report.** Mount the shell around the router outlet. Put each heading and its body in a sibling
  `PageSection`. The shell and sections own the sticky geometry. See [workspace layout](references/workspace.md) and
  [report loading and inspection](references/reports.md).
- **Tabbed workspace.** Put page-wide navigation and its actions in the page navigation slot. Use links for route
  destinations and tabs for panels within the current view.
- **Consequential form.** The owner validates and submits the draft. Use the shared confirmation and pending states,
  mark sensitive input at its source, and keep the draft available when the save fails.

For a task outside those four recipes, search the same catalog for a public component. Inspect its declaration for
supported props and callbacks. In a running Elements Storybook, an MCP client can also discover components and examples
at `/mcp`.

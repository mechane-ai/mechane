---
name: use-elements
description:
  Build React pages with Mechane Elements. Use when adding or changing UI in an app that has `@mechane-ai/elements`
  installed, such as a table, report, chart, form, workspace shell, conversation, or agent access.
---

# Build with Elements

## Look it up in the installed version

From the app with `@mechane-ai/elements` installed, look up the user's task:

```sh
pnpm exec mechane-elements-catalog "searchable table with filters"
```

The answer is JSON for the installed version: the matching recipes, the best recipe's TSX, and its public imports. Start
from that TSX. The same example runs in the Elements Storybook under **Recipes**.

Look up one component by its export name, without spaces:

```sh
pnpm exec mechane-elements-catalog segmentedcontrol
```

Each match names its import path and its declaration file inside the package. Read that declaration for the props and
callbacks. Do not guess a prop from another library. The same index is at `@mechane-ai/elements/catalog.json`.

## Set up once

- Import `@mechane-ai/elements/styles.css` once at the app entry. Ordinary React apps need no StyleX compiler.
- Spread `themeProps.light` or `themeProps.dark` from `/theme` onto the document root, so portaled menus and dialogs
  inherit the theme. The app stores the preference. The spread is a `className`: a later `className` on the same element
  replaces it silently, so give the theme its own element or join the class names (see
  [styling](references/styling.md)).
- Mount one `Toaster` from `/feedback` at the root when the app reports outcomes with `toast`.
- Supply the app's own reset and fonts. See [styling](references/styling.md) for layers, tokens and a nonce policy.

## Who owns what

Elements owns the interaction, focus, keyboard, announcements and appearance. The app owns routes, data, authorization,
persistence and every asynchronous operation.

- Pass a controlled value with its change callback, or an uncontrolled default. Never both.
- A change callback receives the value, then the change details. `details.reason` names what happened and
  `details.source` says whether a pointer, the keyboard, an agent or code caused it.
- Pass pending, failed and ready states in. A click or a resolved request does not mean the operation completed.
- Import from the family that owns the interaction. Do not import `@ui-sdk/react` beside Elements for the same control.
- Use a named `variant`, `tone` or `density`. There is no size, padding or radius prop. `xstyle` takes placement only,
  such as width or alignment.

## Pick the component

| The page needs                                    | Use                                                                                                             | Read                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| An app frame, a page, sections, a record page     | `AppShell`, `PageLayout`, `PageSection`, `RecordPage`                                                           | [workspace](references/workspace.md)                     |
| A searchable, filterable full-width table page    | `CollectionPage` (wires top-bar search, filters, chips, shortcuts & optional inspector)                         | [workspace](references/workspace.md)                     |
| Records compared across columns, search, filters  | `DataTable` with a `query`                                                                                      | [collections](references/collections.md)                 |
| A selected record's fields beside its list        | `Inspector`, `Details`                                                                                          | [collections](references/collections.md)                 |
| Fields, choices, dates, files, a save             | `Field`, the `/forms` controls, `FormActions`, `ConfirmButton`                                                  | [forms](references/forms.md)                             |
| A trend, comparison, distribution or relationship | One chart from a `/charts/*` entry                                                                              | [charts](references/charts.md)                           |
| A figure an agent or a server writes as JSON      | `Figure`, `validateFigureSpec`, `describeFigure` and `chartGuide` from `/charts/figure`                         | [figures](references/figures.md)                         |
| A run, evaluation, research, service or feature   | A kit from `/kits/training`, `/kits/evaluation`, `/kits/research`, `/kits/operations`, `/kits/interpretability` | [kits](references/kits.md)                               |
| Page focus, zero-card layout, anti-slop copy      | Flat `MetricGrid`, hairline sections, `CollectionPage`, concise titles                                          | [editorial restraint](references/editorial-restraint.md) |
| An explorable essay, a lesson, a moving diagram   | `/lesson`, `/scene`, `/article` and `/mdx`, planned with `/lesson/spec`                                         | [teaching](references/teaching.md)                       |
| A first read, a refresh, an empty or failed read  | `AsyncRegion`, `LoadingScope`, `EmptyState`, `Notice`                                                           | [reports](references/reports.md)                         |
| A command menu, a decision, an anchored panel     | `Menu`, `AlertDialog`, `Dialog`, `Drawer`, `Popover`, `Tooltip`                                                 | the catalog                                              |
| Route destinations or panels inside one view      | `PageNavigation` for links, `Tabs` or `ContentTabs` for panels                                                  | [workspace](references/workspace.md)                     |
| A transcript, a prompt, tool activity, approvals  | `Conversation`, `Message`, `PromptInput`, `Approval`                                                            | [conversations](references/conversations.md)             |
| Markdown, source, a diff, a file tree, a log      | `/content/markdown`, `/content/code`, `/content/diff`, `/content/tree`, `/content`                              | the catalog                                              |
| A model or browser agent that reads and acts      | `createAgent` and `registerTools` from `/agent`                                                                 | [agent access](references/agent.md)                      |

## Start from a recipe

- **Searchable collection.** Use local query mode for a complete finite collection. For a paged source, send search and
  filters to the data owner before it takes a page. Keep the query and current page together in route state when users
  need to return to the same results.
- **Sectioned report.** Mount the shell around the router outlet. Put each heading and its body in a sibling
  `PageSection`. The shell and sections own the sticky geometry.
- **Linked figures.** Give each model, run or series one id. Wrap the figures in `ToneScope` and `ChartLink` so a thing
  keeps one hue and inspecting it in one figure marks it in the others.
- **A chart you cannot name.** Read `chartGuide` from `/charts/figure`, or the chooser in
  [charts](references/charts.md). It lists all 50 registered charts by family, with when to use each one.
- **Allocation report.** Show how one total divides with a parts strip above one explanatory chart. Give each part one
  tone everywhere.
- **Tabbed workspace.** Put page-wide navigation and its actions in the page navigation slot. Use links for route
  destinations and tabs for panels within the current view.
- **Consequential form.** The owner validates and submits the draft. Use the shared confirmation and pending states,
  mark sensitive input at its source, and keep the draft available when the save fails.

For a task outside the recipes, search the catalog for a public component and compose it with the layout parts above. In
a running Elements Storybook, an MCP client can also discover components and examples at `/mcp`.

## Before you finish

Check the page with the `review-elements` skill: keyboard alone, every read state, a phone width, the dark theme, and
what an agent sees. Check an explorable essay with the `review-explainer` skill too. After a package upgrade, follow the
`upgrade-elements` skill.

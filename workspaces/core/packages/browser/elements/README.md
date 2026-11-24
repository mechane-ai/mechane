# Elements by Mechane

React components for applications, AI interfaces, and analytical graphics. Elements combines compact typography, square
surfaces, shared visual tokens, and accessible interactions. Mechane's Console consumes the same package. Components
receive values and callbacks; applications own routing, data, identity, and persistence.

Interactive Elements use the UI SDK React primitives or compose other Elements. StyleX owns their appearance.
Applications import the Elements family that owns the interaction. When adding a control, start with the matching family
and its Storybook example. Keep focus, value changes, and dismissal with one primitive. Native links retain browser
navigation and modifier-key behavior.

## Build with an agent

The package ships skills that teach a coding agent this library, matched to the installed version. Copy them into the
agent's skills directory from a project with Elements installed:

```sh
pnpm exec mechane-elements-catalog --install-skills .claude/skills
```

Use `.agents/skills` or another directory for an agent that reads skills from there. Run the command again after each
upgrade; it replaces the six skills with the new version's copies.

| Skill                                                | Use it to                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| [use-elements](skills/use-elements/SKILL.md)         | Choose components and build a page, with a guide for each family.        |
| [review-elements](skills/review-elements/SKILL.md)   | Check a page by keyboard, read state, width, theme and agent access.     |
| [upgrade-elements](skills/upgrade-elements/SKILL.md) | Move an app to a new version, with the changes each release needs.       |
| [plan-lesson](skills/plan-lesson/SKILL.md)           | Plan an explorable essay as a checked lesson plan before writing code.   |
| [write-explainer](skills/write-explainer/SKILL.md)   | Write the essay from a valid plan with the teaching layers.              |
| [review-explainer](skills/review-explainer/SKILL.md) | Review an essay as a learner, in all four views.                         |
| [extend-elements](skills/extend-elements/SKILL.md)   | Change the library itself. It stays in the package and is not installed. |

An agent without skills can read the same files in place. Add one line to its instructions file, such as `AGENTS.md`:
"Before building UI, read `node_modules/@mechane-ai/elements/skills/use-elements/SKILL.md`."

Find a recipe by task, or a component by its export name:

```sh
pnpm exec mechane-elements-catalog "searchable table with filters"
pnpm exec mechane-elements-catalog segmentedcontrol
```

The catalog connects a task to the example's TSX, public imports, and rendered Storybook story, and a component to its
import path and declaration file. Read the same index programmatically at `@mechane-ai/elements/catalog.json`. When
running the local Elements Storybook, connect an MCP client to `http://localhost:6006/mcp` to explore the examples while
developing.

## Enable an agent in an app

Create the bridge at browser startup. A host integrating its own model can use the tool definitions in `agentTools`. To
expose tools to the browser through WebMCP, call `registerTools` explicitly and keep its cleanup function:

```ts
import { createAgent, registerTools } from '@mechane-ai/elements/agent';
import type { AgentAction } from '@mechane-ai/elements/agent';

const allow = (step: AgentAction) =>
  step.confirm === undefined && step.component === 'collection-query' && step.action === 'setQuery';

const agent = createAgent({ allow });
const unregister = registerTools(agent, { allow });
// Call unregister() when the host ends this integration.
```

This example permits changing a collection search. A host can query or snapshot mounted components to discover their
available actions. After requesting a change, read the resulting state, including pending or error feedback from the
data owner. Keep credentials and private values out of observable labels, descriptions, and results. The application
authorizes data reads and mutations on the server.

| What the agent needs    | What to look for in the mounted UI                                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find and open a record  | Use the named `collection-query`, then re-read `collection-results` until its `status` is `ready`. A pending or failed read can retain the previous rows. Each item is a row named as a reader sees it. Use the `open`, `sort`, `select`, `previousPage` and `nextPage` actions of `collection-results`. |
| Know where the user is  | Read the `page-title`, current `link` or tab, and the `page-section` at the reading position. Scrolling updates the section an agent can query.                                                                                                                                                          |
| Inspect a chart or file | Query chart or tree items for the visible label and identifier. Read the chart's formatted `readout` after inspection. After selection, query the inspector's labeled `detail-field` entries.                                                                                                            |
| Complete a form         | Use visible field validation and `form-status` for pending, error, or success. Use `Field.Root isSensitive` to hide sensitive labels, values, and validation from the bridge. Put `ConfirmButton` on the action that performs a consequential mutation.                                                  |

## Install

Install [Elements from npm](https://www.npmjs.com/package/@mechane-ai/elements). React and React DOM are peer
dependencies. TypeScript consumers also supply the optional `@types/react` peer so declarations resolve in isolated
builds without relying on hoisted development dependencies.

```sh
pnpm add @mechane-ai/elements react react-dom
```

Load the stylesheet once, then import the families you use:

```tsx
import '@mechane-ai/elements/styles.css';
import { Button } from '@mechane-ai/elements';
import { Dialog } from '@mechane-ai/elements/overlays';

export function Example() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button />}>Details</Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Popup>
        <Dialog.Title>Details</Dialog.Title>
        <Dialog.Description>The application supplies this content.</Dialog.Description>
        <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
```

Elements supplies compiled ESM, TypeScript declarations, and CSS. Ordinary React consumers need no StyleX compiler.
Applications install their own reset and fonts. Put reset rules in the `reset` CSS layer. Elements and consumer StyleX
rules share the compiler's ordered `priority` layers. Keep those layers at the top level: wrapping Elements in another
layer lets consumer base declarations override component hover and focus states. Packaged token defaults and themes use
`priority1`; ordinary unlayered application rules can override the package. Consumer-generated themes follow their own
emitted layers and selector specificity.

## Imports

Every path below belongs to `@mechane-ai/elements`. There is one package, version, and stylesheet.

| Entry                    | Responsibility                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Root                     | Buttons, text, surfaces, disclosure, avatars, and CopyValue.                                                   |
| `/forms`                 | Fields, inputs, selection, appearance picking, file picking, and settings sections.                            |
| `/forms/dates`           | Civil-date pickers, range selection, and a controlled event month.                                             |
| `/overlays`              | Dialog, Drawer, Menu, Popover, Preview, Tooltip, and AlertDialog.                                              |
| `/feedback`              | Async regions, skeletons, progress, meters, notices, empty states, and toasts.                                 |
| `/navigation`            | Tabs, page navigation, breadcrumbs, skip links, and shortcut labels.                                           |
| `/navigation/commands`   | Command palette and scoped application-owned shortcuts.                                                        |
| `/layout`                | Application shell, sidebar, toolbars, compound record pages, and resizable panes.                              |
| `/collections`           | Tables, inspectors, collection controls, timelines, metrics, and timestamps.                                   |
| `/content`               | Trace, JSON, recorded logs, and stack traces.                                                                  |
| `/content/link`          | Safe content links without a renderer dependency.                                                              |
| `/content/markdown`      | Completed and streaming Markdown, embedded headings, and inert previews.                                       |
| `/content/code`          | Source-preserving code highlighting.                                                                           |
| `/content/diff`          | File changes and patches.                                                                                      |
| `/content/tree`          | File paths, statuses, and controlled selection.                                                                |
| `/ai`                    | Conversations, messages, prompts, approvals, sources, and citations.                                           |
| `/charts`                | Figure props, formats, tone scope, linked inspection, frames, legends, and grids.                              |
| `/charts/cartesian`      | Lines, ranges, areas, sparklines, small multiples, bars, bridges, and scatter plots.                           |
| `/charts/distribution`   | Histograms, cumulative distributions, intervals, ranked values, box, violin, strip, and ridgeline plots.       |
| `/charts/matrix`         | Matrices and their confusion, correlation, attention, and calendar presets, token heatmaps, and color legends. |
| `/charts/graph`          | Supplied relationships, weighted flows, attribution graphs, and tree diagrams.                                 |
| `/charts/hierarchy`      | Treemaps and icicles.                                                                                          |
| `/charts/timeline`       | Waterfall intervals and instants, and lanes of events.                                                         |
| `/charts/trend`          | Curves over a step or layer, many runs, slopes, rank changes, and horizon rows.                                |
| `/charts/comparison`     | Dot plots, dumbbells, and bullet bars.                                                                         |
| `/charts/relationship`   | Contours, scatter matrices, parallel coordinates, embedding maps, and density maps.                            |
| `/charts/text`           | Token examples, next-token predictions, layer by position token grids, and token links.                        |
| `/charts/image`          | Image grids, attribution overlays, and image atlases.                                                          |
| `/charts/cells`          | Bar, heat, change, interval, and spark graphics for table cells.                                               |
| `/charts/transforms`     | Bins, densities, fits, quantiles, ranks, smoothing, and sampling that an application calls before drawing.     |
| `/charts/plot`           | The plot kernel: scales, ticks, axes, marks, and states for a chart the library lacks.                         |
| `/charts/figure`         | Figure specs as JSON: validate a spec, draw it, describe it, and read the chart guide.                         |
| `/lesson`                | Lessons: named values with ranges, controls in prose, players, one shared clock, and tweens.                   |
| `/lesson/spec`           | Lesson plans and defined lessons as data: checks, outlines, teaching advice, and the explainer guide.          |
| `/lesson/agent`          | Tutor tools, a learner trace, and guided tours over the agent bridge.                                          |
| `/scene`                 | Diagrams whose objects keep their identity: nodes, wires, plane marks, cards, cells, tokens, and flows.        |
| `/article`               | Explorable essays: beats, figures, predictions, challenges, notes, and four views of one essay.                |
| `/mdx`                   | An essay written as one MDX file, with every teaching part available without imports.                          |
| `/kits/training`         | A run dashboard, a run table, and a sweep overview.                                                            |
| `/kits/operations`       | Service health, budgets against objectives, and an incident timeline.                                          |
| `/kits/evaluation`       | A model leaderboard, a score breakdown, and a two-model comparison.                                            |
| `/kits/interpretability` | Feature cards and lists, an attribution workbench, attention heads, a logit lens, a feature map, and steering. |
| `/theme`                 | Light and dark theme props.                                                                                    |
| `/agent`                 | Optional UI SDK bridge for a host that enables component inspection and actions.                               |
| `/csp`                   | Application-supplied content security policy configuration.                                                    |
| `/tokens`                | Compiled token references for runtime styles.                                                                  |
| `/tokens.stylex`         | Variable definitions for StyleX authoring and themes.                                                          |
| `/constants.stylex`      | Compile-time conditions, palette values, layers, and shared geometry.                                          |
| `/styles.css`            | Component styles and token defaults.                                                                           |

Focused entries keep renderer and chart dependencies out of basic controls. There is no all-components barrel. Renderers
initialize when used, without a consumer-managed worker pool or grammar CDN. The
[content guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-content.md) explains assets,
input limits, and readable fallbacks.

## Composition and themes

Choose the
[containing task and layout](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/visual-system.md#composition-decisions)
before adding a surface. Stack related page sections. `PageContent` insets content, `PageSection` combines inset content
with full-width finite rows, and `CollectionLayout` gives a primary collection its available height. Dialogs, inspectors
and structured message Cards retain their own containing width. `Panel` bounds an independent unit.

Use Elements' `render` composition and named variants for appearance. Native attributes, events, and refs remain
available. Typed `xstyle` inputs permit placement styles compiled by the application's StyleX setup. Applications own
asynchronous work and pass its pending, success, or failure state to controls.

Use `ToolbarAction` for page-header actions, including links composed with `render`. A clipboard action can compose
`CopyValue render={<ToolbarAction />}`; the rendered control owns its appearance and CopyValue owns copy feedback. Use
`Row` for aligned inline actions, `Stack` for related content, and `RecordPage.Content` for separated page sections.
Detail titles wrap; list metadata truncates. Sidebar items share contiguous hit areas. Supply `AppShell` with a
`NavigationRail` in its `rail` slot for persistent area links. It occupies 48px of the 240px navigation budget beside a
192px contextual sidebar. Collapsing hides the contextual sidebar and retains the rail. The phone drawer renders those
area links with visible labels above its pages. Its width, toolbar height, and footer cell share the same 48px geometry.
Use `railFooter={{ navigation, menu }}` to group persistent links such as Settings with the account menu. The shell
supplies the same gap between these targets as between the primary links. Supply menu content and actions in `menu`.
`Avatar` supports `shape="circle"` for an initials or photo trigger. Applications supply selection, URLs, native link
handlers, and action callbacks. Omit the rail for a sidebar that collapses to page icons.
`SidebarFooter layout="navigation"` holds persistent controls in the contextual sidebar and reserves their intrinsic
height while its pages scroll independently.

Use `PageLayout` for a screen. Give it the page title, actions, and optional `navigation` with the destination links,
selected ID, and view actions. The toolbar and navigation keep their natural height above the scrolling body. Wrap each
report section's heading and content together in a sibling `PageSection`. Its heading stays visible until the next
section arrives. On a short viewport the body prioritizes reading space. Use `RecordPage.Layout` for a record with a
back link and optional route navigation. A bounded table or workbench can fill the page body and scroll its own rows or
panes. Set `scrollRestorationId` when the router restores a named page body.

`PageNavigation` uses real destination links; `Tabs` switches associated local panels with keyboard tab semantics. Both
share the same typography, height, inset and selected indicator. Supply view controls through `PageNavigation.actions`
so the links keep their own scroll region. Do not wrap page navigation in another padded collection toolbar. A
collection's title and controls belong in one named header; applied filter chips may follow it.

Navigation closes the mobile drawer and preserves focus set by the destination. Use
`NavigationItem shouldCloseOnActivate={false}` for menu triggers.

`AppShell shouldFocus` temporarily hides navigation while retaining its expansion state. `ViewStack.Panel` keeps
inactive content mounted and measurable but removes it from keyboard and assistive-technology navigation. The
application owns which view is active and when to unmount it; use this for a draft or reading position that must survive
inspection. `WorkbenchScroll` requires an accessible `label`; its `isFlush` mode leaves list insets to the table. Its
`scrollRestorationId` identifies the actual scroll region for application-owned restoration. Layout wrappers leave
sequential keyboard navigation to their controls. Tables and viewers add a named scroll stop when overflow needs one.
Interactive charts have one Tab stop, a local datum cursor, and arrow-key inspection. Enter or Space activates supplied
selection; Escape dismisses the readout while retaining the cursor.

Change callbacks receive the UI SDK's change details after the value. `details.reason` names what happened, such as
`input-change`, `clear-press` or `item-press`, and `details.source` says whether a pointer, the keyboard, an agent or
code caused it. `Input` and `Textarea` `onValueChange`, a collection's `search.onChange` and `search.onSubmit`, a
filter's `onChange`, `FilterChips` `onRemove`, a chart's `onSelectedChange` and a table's `onSortChange` and
`onSelectionChange` all pass them.

`Workbench` accepts an optional `inspector={{ label: 'Workspace', content: <WorkspaceFiles /> }}`. The application
supplies the accessible name with the panel content and owns opening, closing, and focus restoration. The inspector
replaces the main column at compact widths while keeping that column mounted.

Every `DataTable` requires a `query`. For a finite list, supply the complete authorized rows and declare how users can
search and filter them.

```tsx
query={{
  mode: 'local',
  search: (item) => item.name,
  filters: [{ id: 'status', label: 'Status', value: (item) => item.status }],
}}
```

For paged records use `mode: 'controlled'` with query values and callbacks. Apply search and filters before server
pagination. When an enclosing collection already supplies the controls, declare its capabilities with `TableQueryFrame`
and use `mode: 'frame'` on its table. A static table, or an individual capability that does not apply, requires a
reason.

Each `DataTable` column declares a role: `primary`, `text`, `status`, `number`, `timestamp`, or `actions`. Roles own
alignment and minimum sizing; the primary column uses available space. Headers and placeholders follow the same
geometry. The table uses 48px rows by default and truncates text to preserve stable column and virtualization geometry.
Set `rowSizing="content"` for records that need multiline cells; virtualization then measures those rows. Long content
belongs in a detail view or a deliberately content-sized row, not behind a clipped control. Use `DataTableText` for a
primary string and optional secondary string inside one cell; both text elements own their ellipsis. Arbitrary nested
layouts do not inherit text truncation. Give dates and numeric values sufficient column width or explicit content
sizing. The table owns its cell insets, so an enclosing page should not add another gutter around its rows. A table's
row actions share one Tab stop. Arrow keys move by a row, Page Up and Page Down by ten, and Home and End reach the first
and last supplied row, including rows the window has not rendered. With `selectedIds`, a row's checkbox toggles it,
Shift and a click select the range from the row chosen before, and the header checkbox selects every supplied row. The
control row above a table is one UI SDK toolbar: applied filter chips, find, filters and display share a Tab stop, and
arrow keys move between them. `CollectionEnd` renders nothing when complete unless an explicit summary is supplied.
`Timeline.Root` and `Timeline.Item` compose readable activity with supplied titles, icons, timestamps, metadata, and
body content, without interpreting domain events. The events share one Tab stop on the UI SDK timeline, and arrow keys
move between them.

`CommandActivity` from `/ai` presents a collapsed Bash command with supplied execution state. Its `CommandDetails` body
is also available for an existing trace disclosure. Supply command and output text separately, with explicit omission
notices when a preview is shortened. Commands use Bash highlighting; output stays plain unless the application supplies
a known `outputLanguage`. The embedded code and log variants share compact frames and separate copy controls. Keep
overall `ReplyIndicator` progress below command activity.

`Message` reserves space for secondary actions and reveals them on hover and keyboard focus; touch devices keep them
visible. `MessageAction` supplies a named icon button and tooltip. Keep errors, decisions, and current activity outside
that action region. `MessageBoundary` groups expandable context between messages. `PromptInput` keeps its label
accessible while integrating the submit control into the input frame. The application owns submission identity,
acknowledgement, and draft retention.

`AgentAvatar` derives a repeatable shape and palette from a supplied seed, or renders an explicit appearance.
`AgentAvatarPicker` accepts that appearance and reports changes; applications own storage. Keep the same seed for a
record and store named choices rather than catalog indexes. Identity palettes remain separate from status colors.

`MetricGrid layout="columns"` distributes supplied metrics by available container width. Its inline layout suits compact
record summaries. `Metric` offers `statistic` and `headline` variants, a concise `detail`, and a passive `trend` slot.
Use `isLoading` and `hasDetail` to reserve its value and qualification while the application loads data.

Use a chart's `report` input for a self-contained analytical report with a compact caption, period summary and plot. The
[chart guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-charts.md#composition) explains
summary choices, scoped actions and matching placeholders, with links to the maintained examples. Embedded charts use
their ordinary frame within the containing region. The application owns periods, aggregates, coverage and read state.

Keep full-width tables outside `PageContent` so their cell insets remain the only gutter. `PageSection` owns the inset
for its optional `summary` and leaves its `breakdown` full width. Pass summary content directly; omit it when a section
contains only rows. Absent, `null` and `false` summaries reserve no empty space. `ContentTabs` uses `defaultSelectedId`
for an initial local choice. Give shareable views real links in the navigation slot on `PageLayout` or
`RecordPage.Layout`. `SettingsSection` keeps wide tables inside their scroll region, and `SettingsRow` aligns labels and
controls. Use `isPlaceholder` on a decorative row without a control ID; ready rows require a real `controlId` for their
label. `FormActions` owns submission rows and their internal spacing. The enclosing section owns the gap before and
after the actions.

Elements 0.29 removes `ReportSection`. Move its metric summary into the explanatory chart's `report.summary` or
`report.seriesValues`. Use ordinary `Stack` composition when content already belongs to an existing region.

The default theme is light, with system fonts and a compact spacing scale. Import `themeProps` from
`@mechane-ai/elements/theme` and spread `themeProps.light` or `themeProps.dark` onto the document root. Portaled content
then inherits the same theme. The application owns the preference; no theme provider is required.

`themeProps.dark` is a `className` and a `style`. A later spread with its own `className`, such as
`{...themeProps.dark} {...stylex.props(styles.root)}`, replaces the theme's class without an error, and the page is half
dark. Give the theme an element of its own, or join the class names:

```tsx
const theme = themeProps[isDark ? 'dark' : 'light'];
const own = stylex.props(styles.root);

<div className={`${theme.className ?? ''} ${own.className ?? ''}`} style={{ ...theme.style, ...own.style }} />;
```

For custom StyleX styles and themes, import variables from `@mechane-ai/elements/tokens.stylex` and compile-time
constants from `@mechane-ai/elements/constants.stylex`. The archive preserves both defining paths. Variables retain the
same names as the packaged CSS; constants need their source compiled with the consuming styles. The ordinary `/tokens`
entry supplies runtime references and values for both groups.

With Vite and StyleX 0.19.1, configure the consumer as follows:

```ts
import stylex from '@stylexjs/unplugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    stylex({
      useCSSLayers: true,
      debug: false,
      runtimeInjection: false,
      unstable_moduleResolution: { type: 'commonJS' },
      externalPackages: ['@mechane-ai/elements'],
    }),
  ],
  resolve: { alias: [{ find: /^@mechane-ai\/elements\/tokens\.stylex$/, replacement: '@mechane-ai/elements/tokens' }] },
});
```

The bundler alias uses compiled variable references without re-emitting defaults over the selected theme. StyleX still
resolves the original defining path during compilation. Keep `/constants.stylex` direct so its metadata reaches the
compiler. Consumer styles can then use `[conditions.coarsePointer]` from that entry, and
`stylex.createTheme(colors, ...)` with `colors` from `/tokens.stylex`.

When an application's Content Security Policy requires nonces, wrap its component tree in `CSPProvider` from
`@mechane-ai/elements/csp` and pass the same request nonce used in its policy. Preserve that nonce during hydration. The
application owns nonce generation and its security policy.

Mount one `Toaster` from `/feedback` and call its exported `toast` API with a plain-text object such as
`toast.error({ title: 'Could not save' })`. The feedback family owns UI SDK toast behavior and Elements styling. Keep
initial-read failures and field validation local; retained-content refresh failures can use one notification with Retry.
Loading updates require a stable ID, and dismissal names its ID through `toast.dismiss({ id })`. Actions and loading
notices persist. Keep titles, descriptions and action labels brief; longer explanations belong in the relevant view.
Shared toasts bound visible text and wrap actions without narrowing the message. Opening a page or discovering
background status does not warrant a notification. The application owns stable IDs and dismissal on recovery or
navigation.

## Loading content

Use `AsyncRegion` from `/feedback` with an explicit `pending`, `ready`, or `failed` state and a destination-specific
`placeholder`. Pending reserves that geometry immediately and reveals it after two seconds. Ready content enters in
80ms; ready-at-mount and failed content appear immediately. Reduced motion removes the fades. There is no minimum
loading duration, and ordinary callers do not configure timing.

For a photo or image, set `presentation="image"` to show its placeholder immediately and reveal the ready image in
200ms. Ready-at-mount images keep full opacity, including cached revisits. The supplied state covers the application's
fetch and decode, and the reduced-motion preference removes the transition.

Wrap a page in `LoadingScope` and pass its navigation `identity` to share one clock across dependent reads. Updating the
identity resets pending presentation without remounting ready children. Use `initialStartedAt` only to preserve elapsed
document loading time at hydration; later identities start their own clock. Keep refreshes in the ready state and retain
their content, focus, and drafts; display progress or failure alongside the last result.

Build placeholders from the same layouts as their destinations. `DataTablePlaceholder` accepts the real table's
`DataTableColumnLayout` definitions and optional decorative cells. The async region owns the loading announcement; its
placeholders must not contain interactive controls, invented records, or independent status announcements.

## Charts and figures

Every chart is built from one plot kernel and takes the same figure props. This is the idea:

- **One kernel.** Scales, ticks, axes, marks, readout and keyboard cursor come from `/charts/plot`, so charts behave
  alike. A chart owns its input and the arrangement of parts.
- **Shared figure props.** Each chart takes `title`, `description`, `locale`, `source`, `coverage`, `transforms`,
  `status` and `emptyLabel`. Selection is `selected` with `onSelectedChange`. `Waterfall` takes a subset of these.
  `Sparkline`, `ColorLegend` and the table cells are compact graphics and do not take them.
- **Declared formats and locale.** A number is written from `Intl` options and the figure's required `locale`. There is
  no formatter-function prop. Axes are `{ label, domain?, scale?, format, tickFormat? }`, and heights are `'compact'`,
  `'regular'` or `'tall'`.
- **One meaning per visual channel.** Hue names a thing, lightness is a magnitude, two hues around a middle are a signed
  value, a dashed stroke is modelled, a pale band is uncertainty, a hollow mark is missing and gray is context.
- **States.** Each figure has loading, empty, invalid and partial states. A figure that draws part of its data says how
  much beside its title. The footnote names the source and each transform.

Statistics stay outside charts. Compute bins, quantiles, densities and fits with `/charts/transforms` and name them in
`transforms`.

### Choose a chart

The table is the library's own `chartGuide`: one entry per registered chart, grouped by family, with the question the
chart answers. Each family is the import entry `@mechane-ai/elements/charts/<family>`. The
[chart guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-charts.md#choose-a-chart) adds
when to use each chart and when another is better. Use a table when exact comparison matters more than shape.

| Family entry           | Chart                 | The reader asks                                                          |
| ---------------------- | --------------------- | ------------------------------------------------------------------------ |
| `/charts/trend`        | `CurveChart`          | How did a metric change over training steps or another ordered variable? |
| `/charts/trend`        | `RunsChart`           | How does one run compare with the whole sweep it belongs to?             |
| `/charts/trend`        | `SlopeChart`          | How did each item move between two to six conditions?                    |
| `/charts/trend`        | `BumpChart`           | How did the ranking of items change across stages?                       |
| `/charts/trend`        | `HorizonChart`        | Which of many series run above or below normal, and when?                |
| `/charts/comparison`   | `DotPlot`             | How do a few models compare on each of several measures?                 |
| `/charts/comparison`   | `DumbbellPlot`        | How much did each row change between two measurements?                   |
| `/charts/comparison`   | `BulletBar`           | Is each measure meeting its target?                                      |
| `/charts/cartesian`    | `BarChart`            | How large is each amount, by category and series?                        |
| `/charts/cartesian`    | `BridgeChart`         | Which changes add up to the difference between two totals?               |
| `/charts/cartesian`    | `BreakdownBar`        | How does one total split into parts?                                     |
| `/charts/cartesian`    | `ScatterPlot`         | How do two measures of the same records relate?                          |
| `/charts/cartesian`    | `LineChart`           | How did a measure change over time?                                      |
| `/charts/cartesian`    | `AreaChart`           | How did a total and its parts change over time?                          |
| `/charts/cartesian`    | `SmallMultiples`      | How do several related measures move together over the same time?        |
| `/charts/cartesian`    | `Sparkline`           | Which way is one measure trending, at a glance?                          |
| `/charts/distribution` | `Histogram`           | How are the values of one measure distributed?                           |
| `/charts/distribution` | `ECDF`                | What share of values falls below a given level?                          |
| `/charts/distribution` | `IntervalPlot`        | What is each estimate, and how uncertain is it?                          |
| `/charts/distribution` | `RankedBars`          | Which items rank highest on one measure?                                 |
| `/charts/distribution` | `BoxPlot`             | How do the distributions of several groups compare?                      |
| `/charts/distribution` | `ViolinPlot`          | How does the shape of a distribution differ between groups?              |
| `/charts/distribution` | `StripPlot`           | Where does every single value of each group fall?                        |
| `/charts/distribution` | `Ridgeline`           | How does a distribution shift across many ordered groups?                |
| `/charts/matrix`       | `Matrix`              | What is the value for every pair of two categories?                      |
| `/charts/matrix`       | `TokenHeatmap`        | Which tokens of a text carry the most of a score?                        |
| `/charts/matrix`       | `ConfusionMatrix`     | Which classes does a classifier confuse with which?                      |
| `/charts/matrix`       | `CorrelationMatrix`   | Which measures move together?                                            |
| `/charts/matrix`       | `AttentionMatrix`     | Which earlier tokens does each token attend to?                          |
| `/charts/matrix`       | `CalendarHeatmap`     | How does a daily measure vary by week and weekday?                       |
| `/charts/graph`        | `RelationGraph`       | How are a few named things connected?                                    |
| `/charts/graph`        | `FlowDiagram`         | Where does a quantity go between stages?                                 |
| `/charts/graph`        | `AttributionGraph`    | Which features carry a model’s answer from the prompt to the output?     |
| `/charts/graph`        | `TreeDiagram`         | How is a hierarchy structured?                                           |
| `/charts/hierarchy`    | `Treemap`             | Which parts make up most of a total?                                     |
| `/charts/hierarchy`    | `Icicle`              | How does a total split through nested levels?                            |
| `/charts/timeline`     | `Waterfall`           | When did each step of a request or run start and end?                    |
| `/charts/timeline`     | `EventStrip`          | What happened when, across a few kinds of events?                        |
| `/charts/relationship` | `ContourPlot`         | What does a value look like over two continuous inputs?                  |
| `/charts/relationship` | `ScatterMatrix`       | How do several measures relate to each other, pair by pair?              |
| `/charts/relationship` | `ParallelCoordinates` | Which records do well on many measures at once?                          |
| `/charts/relationship` | `EmbeddingMap`        | How do many items cluster in a learned embedding space?                  |
| `/charts/relationship` | `DensityMap`          | Where are points concentrated over two measures?                         |
| `/charts/text`         | `TokenExamples`       | On which passages, and which tokens, does a feature fire?                |
| `/charts/text`         | `TokenPredictions`    | Which tokens does the model expect next, and how did that change?        |
| `/charts/text`         | `TokenGrid`           | How does a per-token value change across layers or conditions?           |
| `/charts/text`         | `TokenLinks`          | Which tokens most influence which later tokens?                          |
| `/charts/image`        | `ImageGrid`           | What do a set of images look like, with a value for each?                |
| `/charts/image`        | `AttributionOverlay`  | Which parts of an image drove the model’s output?                        |
| `/charts/image`        | `ImageAtlas`          | How do images arrange over a two-dimensional layout?                     |

`ColorLegend`, the table cells in `/charts/cells`, the placeholders and the kits are not registered charts, so the guide
does not list them. `chartGuide` is exported from `@mechane-ai/elements/charts/figure`, so an application or an agent
can read the same guidance at run time. Each entry has `chart`, `family`, `question`, `use`, `avoid` and `example`, a
small valid figure spec.

```ts
import { chartGuide } from '@mechane-ai/elements/charts/figure';

const entry = chartGuide.find((item) => item.chart === 'Histogram');
// entry?.question, entry?.use, entry?.avoid, entry?.example
```

### Link figures and keep one hue per thing

Give a thing one id in every figure. `ToneScope` gives each id one hue. `ChartLink` shares one inspected id between the
figures inside it: pointing at a record in one figure marks the record with the same id in the others. `ChartGrid` is a
`ChartLink` and a `ToneScope` laid out as panels with one title.

```tsx
import { ChartLink, ToneScope } from '@mechane-ai/elements/charts';
import { DotPlot } from '@mechane-ai/elements/charts/comparison';
import { CurveChart } from '@mechane-ai/elements/charts/trend';

export function Runs() {
  return (
    <ToneScope ids={['base', 'wide']}>
      <ChartLink>
        <CurveChart
          title="Validation loss"
          locale="en-US"
          series={[
            {
              id: 'base',
              label: 'Base',
              points: [
                { x: 100, y: 4.2 },
                { x: 1000, y: 2.6 },
              ],
            },
            {
              id: 'wide',
              label: 'Wide',
              points: [
                { x: 100, y: 4.1 },
                { x: 1000, y: 2.2 },
              ],
            },
          ]}
          x={{ label: 'Training step', scale: 'log', format: { maximumFractionDigits: 0 } }}
          y={{ label: 'Loss (nats)', format: { maximumFractionDigits: 2 } }}
        />
        <DotPlot
          title="Score by task"
          locale="en-US"
          rows={[{ id: 'code', label: 'Code' }]}
          series={[
            { id: 'base', label: 'Base', values: { code: 0.61 } },
            { id: 'wide', label: 'Wide', values: { code: 0.68 } },
          ]}
          value={{ label: 'Accuracy', domain: [0, 1], format: { style: 'percent' } }}
        />
      </ChartLink>
    </ToneScope>
  );
}
```

A figure that draws series can also take emphasis from outside, which never changes selection:

- `CurveChart`, `DotPlot` and `BarChart` take `highlighted`, the id of the one series drawn at full strength while the
  others fade, or `null` for none. Left out on `CurveChart` and `DotPlot`, it follows the enclosing `ChartLink`, so
  hovering a table row that inspects a series id lights that series. `RunsChart` takes `featured`, a required list of
  the run ids drawn in their hue, and no `highlighted`.
- `CurveChart` takes `labels`: `'legend'` (the default) names the series in a legend, `'inline'` writes each name at the
  end of its line when there is room, and `'none'` leaves them out when a legend beside a grid already names them.
- `useScopedTone(id)` returns the hue the enclosing `ToneScope` gives an id, or `undefined` outside a scope. Use it so a
  word or a diagram part matches its chart.
- `useChartLinkControl()` returns `{ inspected, inspect }` for the enclosing `ChartLink`, or `undefined` outside one.
  Call `inspect(id, { reason, event })` from prose or a diagram to point every linked figure at a record.

### Describe a figure as JSON

A figure spec is `{ chart, props }` as plain JSON. `chart` is the name of a registered chart, and `props` are its props
without callbacks and React content, such as `actions`. An agent or a server writes it. The entry
`@mechane-ai/elements/charts/figure` exports:

| Export                  | What it does                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `FigureSpec`            | The type of a spec. `FigureSpecOf<'Histogram'>` is the spec of one chart.                                   |
| `validateFigureSpec(x)` | Returns `{ kind: 'ok', spec }` or `{ kind: 'invalid', message }`. It checks the structure and never throws. |
| `Figure`                | Draws a spec. It takes `selected`, `onSelectedChange` and `status` beside it.                               |
| `describeFigure(spec)`  | Returns the figure as one short text for a place that cannot draw it.                                       |
| `figureCharts`          | `{ chart, family }` for every registered chart.                                                             |
| `chartGuide`            | The guide above, as data.                                                                                   |

`validateFigureSpec` checks that the input is an object, that `chart` is registered, that `props` is an object holding
every required prop with the right JSON kind, that no function is inside, and that `locale` is not empty. Each chart
then checks its own values. `Figure` runs the same check. For a bad spec it draws the shared invalid figure with the
reason in place of the chart, so a spec an agent got wrong is visible and nothing throws. `selected` and
`onSelectedChange` reach only the charts that take a selection, and `status` replaces the spec's own while newer data
loads.

```tsx
import { Figure, describeFigure, validateFigureSpec } from '@mechane-ai/elements/charts/figure';

const spec = {
  chart: 'Histogram',
  props: {
    title: 'Request latency',
    description: 'Synthetic requests over one hour, in 25 ms bins.',
    locale: 'en-US',
    source: 'Synthetic trace',
    transforms: ['Binned at 25 ms'],
    value: { label: 'Latency (ms)', format: { maximumFractionDigits: 0 } },
    count: { label: 'Requests', format: { maximumFractionDigits: 0 } },
    bins: [
      { id: 'b0', label: '0 to 25 ms', lowerBound: 0, upperBound: 25, count: 120 },
      { id: 'b1', label: '25 to 50 ms', lowerBound: 25, upperBound: 50, count: 340 },
    ],
  },
};

const result = validateFigureSpec(spec);

export function Latency() {
  return result.kind === 'ok' ? <Figure spec={result.spec} /> : null;
}

// For this spec, describeFigure(result.spec) returns:
// A histogram, "Request latency", with 2 bins. Synthetic requests over one hour, in 25 ms bins. Source: Synthetic trace. Transforms: Binned at 25 ms.
```

`describeFigure` names the chart and its title, then the description, how much of the data is drawn when `coverage` is
set, the source, the transforms, and how many records the spec holds. It does not restate the values.

A misspelt chart name is refused with the close names:

```ts
validateFigureSpec({ chart: 'Histogramm', props: { title: 'Request latency', locale: 'en-US' } });
// { kind: 'invalid', message: '"Histogramm" is not a registered chart. Did you mean Histogram?' }

validateFigureSpec({ chart: 'Bar', props: {} });
// { kind: 'invalid', message: '"Bar" is not a registered chart. Did you mean BarChart, BreakdownBar, RankedBars?' }
```

The `use-elements` skill's [figures guide](skills/use-elements/references/figures.md) has the rules for an agent that
writes specs.

### Build a chart the library lacks

`@mechane-ai/elements/charts/plot` is the kernel every chart uses. It exports the scales, ticks and paths, the plot
layout, `PlotSurface`, `PlotAxes` and `PlotClip`, the marks (`LineMark`, `AreaMark`, `BandMark`, `DotMark`, `BarMark`,
`RuleMark`, `IntervalMark`, `LabelMark`, `SymbolMark`, `RingMark`, `LinkMark`, `ConnectorMark` and `GuideMark`), the
`Chart` primitive with `ChartCursor`, `ChartInspection` and `ChartData`, the frame and its states (`FigureFrame`,
`FigureLoading`, `FigureEmpty`, `FigureInvalid`), `useTones`, the tick helpers (`axisTicks`, `timeAxisTicks`,
`tickTexts`, `ticksMinimum`), the label placement helpers (`freeLabelSpot`, `labelBox`), and the canvas and WebGL
layers. `FigureFrame` takes `seriesLegend`, a legend that names things, above the plot, and `scaleLegend`, a color or
size scale, below it. A custom chart that is built from these has the same axes, readout, keyboard cursor, states and
tones as the others. Take `FigureProps`, `formatValue` and `useLinkedInspection` from `/charts`. Do not draw your own
scale or axis.

### Kits

A kit composes charts into a page for one domain: `/kits/training` for runs, `/kits/evaluation` for model comparison,
`/kits/operations` for service health, `/kits/interpretability` for features, attribution, attention and steering. A kit
adds no marks. It decides which figures answer the question and shares one tone scope and one linked inspection between
them. The application supplies every value. The `use-elements` skill's
[kits guide](skills/use-elements/references/kits.md) lists each component and the data it takes.

### Renderer limits

Marks a reader inspects one by one draw as SVG. Most charts export a limits object, such as `scatterLimits`, and refuse
input above it with a message that names the limit. `BarChart`, `BridgeChart`, `BreakdownBar` and `Treemap` share
`categoricalLimits`, exported from `/charts`. `Histogram`, `ECDF`, `IntervalPlot` and `RankedBars` share
`distributionLimits`, exported from `/charts/distribution`. `EmbeddingMap` draws on canvas up to 100,000 points and with
WebGL up to 1,000,000, and `DensityMap` draws its grid on canvas. A canvas or WebGL plot keeps the same inspection,
selection, readout and text alternative as an SVG plot. The WebGL figure was measured in a headless software renderer,
not on a GPU.

## Explorable explanations

A lesson is a set of named values a reader can change, such as a batch size or a temperature, and everything that reads
them: the sentences, the controls, the figures and an agent. Six entries build an essay in layers. `/lesson` holds the
values, `/scene` draws diagrams, `/article` arranges beats of prose and figures, and `/mdx` lets one file hold the
essay. `/lesson/spec` checks a plan before any component exists, and `/lesson/agent` lets a tutor model read and move
the lesson. The idea:

- **One store.** `defineLesson` declares each param with its range, step and format, each derived value as a pure
  function of the values before it, and each beat with its states as plain data. `Lesson` holds the values in one UI SDK
  primitive. A number in a sentence, a slider, a figure, a player and an agent read and set the same names. A value
  outside a param's range is refused with an error that names the param and its bounds.
- **States, not animations.** You say where things are. A `Scene` object given new props eases to them, a wire follows
  its ends, and an object with the same `id` is the same thing in every state. Every move runs on one shared clock
  (`createTween` and `useTween`), and a reader who asked for reduced motion gets the end state at once.
- **One kernel.** A `Scene` draws with the plot kernel, so a diagram has the chart's tones, readout and keyboard cursor.
  Every labelled object is an item the arrow keys reach, and with the scene's `onSelectedChange` a press or Enter acts
  on it, such as turning a card.
- **Four views of one essay.** An `Article` renders the same children as a scrolling essay, a presentation, a static
  page or a beat sheet. The views differ in arrangement only.
- **Only the reader's acts count.** Predictions, challenges and hints change the reader's progress only when the reader
  makes them. A change an agent makes never commits a prediction or reaches a challenge.
- **Agents use the bridge.** The lesson and the reader's progress appear in the UI SDK agent snapshot. Tutor tools, the
  learner trace and tours read and act through `createAgent` and nothing else.

Define a lesson, then put its values in a sentence and a diagram. `Param` is a number the reader drags in place, and
`Value` writes a value in its declared format:

```tsx
import { defineLesson, Lesson, Param, ParamSlider, useLesson, Value } from '@mechane-ai/elements/lesson';
import { Scene, SceneNode, SceneWire } from '@mechane-ai/elements/scene';

const lesson = defineLesson({
  id: 'batch-noise',
  title: 'Why a bigger batch is quieter',
  params: {
    batch: {
      kind: 'number',
      label: 'Batch size',
      value: 4,
      min: 1,
      max: 256,
      step: 1,
      scale: 'log',
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    noise: {
      label: 'Gradient noise',
      format: { style: 'percent', maximumFractionDigits: 0 },
      from: ({ batch }) => 1 / Math.sqrt(batch),
    },
  },
  beats: [
    {
      id: 'noise',
      title: 'Noise falls with the square root',
      goal: 'Find that four times the examples halves the noise.',
      states: [
        { id: 'four', label: 'Four examples', values: { batch: 4 } },
        { id: 'sixty-four', label: 'Sixty-four examples', values: { batch: 64 } },
      ],
    },
  ],
});

function BatchScene() {
  const { values } = useLesson(lesson);

  return (
    <Scene title="From a batch to a gradient" x={[0, 2]} y={[0, 1]} height="compact">
      <SceneNode id="batch" at={[0.5, 0.5]} text={`${values.batch} examples`} />
      <SceneNode
        id="gradient"
        at={[1.5, 0.5]}
        shape="pill"
        text="gradient"
        label={`The averaged gradient, ${Math.round(values.noise * 100)}% as noisy as one example`}
        tone={values.noise > 0.5 ? 'negative' : 'positive'}
      />
      <SceneWire from="batch" to="gradient" label="The examples are averaged" />
    </Scene>
  );
}

export function BatchPage() {
  return (
    <Lesson lesson={lesson} locale="en-US" shouldSyncUrl>
      <p>
        A gradient from <Param name="batch" /> examples is <Value name="noise" /> as noisy as one example.
      </p>
      <BatchScene />
      <ParamSlider name="batch" />
    </Lesson>
  );
}
```

A state is the whole picture. `showState` (and `show` from `useLesson`) sets every param the state does not name back to
the lesson's opening value, so a state looks the same live, on the beat sheet and in a tour. `setMany` changes some
params and keeps the rest. `show` and `reset` act on the whole lesson: a figure's Reset button that calls `reset` clears
what the reader did in every other beat. Call `resetBeat(beat)` instead. It returns only the params that beat owns to
their opening values, in one change with the reason `reset`. A beat owns the params its `params` lists, or else those
its states set.

`useLesson(lesson)` types the values from the definition, so `values.noise` is a number and `set('batch', 'high')` does
not compile. `shouldSyncUrl` keeps the values in the address bar, and `storageKey` keeps them across visits. A `Scene`
without a `locale` takes the locale of the `Lesson` around it.

An `Article` renders the `Lesson` for you and arranges its children as beats. A `Beat` takes the id of a beat the lesson
declares, so its title, tutor notes, reveal steps and states stay in the definition. `Figure` numbers a figure, gives it
a caption and a text description, and `Predict` asks the reader to commit a guess before the answer shows:

```tsx
import { Article, Beat, Figure, Predict } from '@mechane-ai/elements/article';

export function BatchEssay() {
  return (
    <Article
      lesson={lesson}
      locale="en-US"
      title="Why a bigger batch is quieter"
      summary="The gradient of a batch is an average. See how its noise falls as the batch grows."
      storageKey="batch-noise"
    >
      <Beat id="noise">
        <p>
          With <Param name="batch" /> examples, the gradient is <Value name="noise" /> as noisy as one example.
        </p>
        <Predict
          id="quadruple"
          prompt="Four times the examples: how does the noise change?"
          options={[
            { id: 'quarter', label: 'It falls to a quarter' },
            { id: 'half', label: 'It halves' },
          ]}
          answer="half"
        >
          <p>Noise falls with the square root of the batch size, so four times the examples halves it.</p>
        </Predict>
        <Figure
          id="batch-scene"
          caption="A batch of examples is averaged into one gradient."
          description="Two boxes joined by an arrow: the batch of examples and the gradient they average into."
        >
          <BatchScene />
        </Figure>
      </Beat>
    </Article>
  );
}
```

A figure with controls takes them as `header` or `footer`. The figure then sits in one hairline frame, with a strip
above or below the visual, ruled off from it. `isFramed` frames a figure with no controls, so every figure in an essay
can share the frame; a figure with a strip is always framed. A chart or scene inside an article `Figure` keeps its title
as its accessible name, but prints neither the title nor the description: the figure's number and caption say what it
is. Write the caption for the reader and the chart's title as its name.

Give `Article` a `view` of `'article'` (the default scrolling essay with a contents list), `'present'` (one beat at a
time; Right or Space goes on, and a beat opens at its first declared state), `'static'` (every beat open at its first
state, each figure followed by its description, no script needed) or `'sheet'` (every beat in each declared state, each
figure scaled to fit, its tutor notes, and a list of checks). The sheet names a beat with no figure, a figure with no
description, a player with no `Transport` and a sentence control that changes no figure.

An application whose own navigation lists the beats, such as a rail in an `AppShell`, holds the beat and passes it
through `lessonProps`, and sets `hasContents={false}` so the article shows no second list:

```tsx
<Article
  lesson={lesson}
  locale="en-US"
  title="Why a bigger batch is quieter"
  hasContents={false}
  lessonProps={{ beat, onBeatChange: (next) => next !== null && setBeat(next) }}
>
  {essay}
</Article>
```

Scrolling the essay then moves the rail, and a press in the rail scrolls the essay to that beat.

`recipes/counting-cards.tsx` (story `Recipes/Counting Cards`) is a full example on every layer, and
`recipes/explorable-essay.tsx` is a short one.

### Choose an entry

Every part has a question it answers; `explainerGuide` from `/lesson/spec` lists them with when to use each and an
example. The
[teaching guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-teaching.md#choose-a-part)
writes the guide out.

| Entry           | Main exports                                                                                                       | The author asks                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `/lesson`       | `defineLesson`, `Lesson`, `useLesson`, `Param`, `Value`, `ParamSlider`, `Playback`, `Transport`, `createTween`     | Which values can the reader change, and who reads them?         |
| `/scene`        | `Scene`, `SceneNode`, `SceneWire`, `SceneAxes`, `SceneCurve`, `SceneCard`, `SceneCells`, `SceneFlow`, `MorphScope` | What is where, and what moves when a value changes?             |
| `/article`      | `Article`, `Beat`, `Figure`, `Scrolly`, `Predict`, `Challenge`, `Term`, `DiagramPart`, `Footnote`, `References`    | What is the order of the argument, and what does the reader do? |
| `/mdx`          | `Essay`, `essayComponents`                                                                                         | Is the essay mostly prose?                                      |
| `/lesson/spec`  | `validateLessonPlan`, `checkLesson`, `describeLesson`, `lessonWalk`, `explainerGuide`                              | Is the plan sound before any component exists?                  |
| `/lesson/agent` | `tutorTools`, `createLearnerTrace`, `summarizeTrace`, `playTour`, `validateTour`, `tourFromTrace`                  | What can a tutor read and do beside the reader?                 |

### Write an essay as MDX

`/mdx` is for an essay that is mostly prose. `Essay` renders a compiled `.mdx` file inside an `Article`, and
`essayComponents` lets the file use Markdown and every teaching part with no imports. The application brings its own MDX
compiler, such as `@mdx-js/rollup`, and a math typesetter if it wants one. Start from the starter:

```sh
pnpm exec mechane-elements-catalog --new-essay my-essay
cd my-essay
pnpm install
pnpm dev
```

The command copies the starter into a new or empty directory, names the package after it and pins `^` this version of
Elements. It writes `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `plan.json` (the lesson as plain
data), `AGENTS.md`, `README.md` and a `src` folder with `lesson.ts`, `figures.tsx`, `essay.mdx`, `main.tsx` and
`mdx.d.ts`. `pnpm dev` serves the essay at `/`, and `?view=present`, `?view=static` and `?view=sheet` show the other
views of the same file. In `main.tsx`, `<Essay lesson={lesson} content={Content} locale="en-US" {...meta} />` renders
the file, and `Content` and `meta` come from `import Content, { meta } from './essay.mdx'`.

For math, an essay file uses `<TeX>` (the article's math part, exported as `TeX`), and `Article` typesets it through its
`math` prop. In the file, a sentence reads `At a rate of <Param name="rate" /> the loss is <Value name="loss" />.` and a
figure is `<Figure id="curve" caption="…" description="…">…</Figure>` inside `<Beat id="…">`. The `view` address
parameter chooses the view unless `Essay` gets a `view` prop.

### Plan and check

Draft the lesson as plain JSON before writing components. A `LessonPlan` names the audience, the one idea, the params,
the derived values and the beats, and each beat may name the figure it shows and what it asks of the reader.
`validateLessonPlan` returns every finding with a path and a sentence, and `checkLesson` gives teaching advice on a
defined lesson. An error means `defineLesson` would refuse it. Advice, such as a beat with no goal or a beat that
introduces two params at once, you may decline:

```ts
import { checkLesson, validateLessonPlan } from '@mechane-ai/elements/lesson/spec';

const result = validateLessonPlan(plan);

for (const finding of [...result.findings, ...checkLesson(lesson)]) {
  console.log(`${finding.severity} at ${finding.path}: ${finding.message}`);
}
```

Three skills cover this work: `plan-lesson`, `write-explainer` and `review-explainer`. `--install-skills` installs them
with the others.

### Teach with an agent

The lesson appears in the UI SDK agent snapshot as a `lesson` entry named by the lesson's title, with the values, the
beat, the reveal step and the running player. Its actions are `setParam`, `setParams`, `showState`, `reset`, `setBeat`,
`next`, `previous`, `play` and `pause`. An `Article` adds a `lesson-progress` entry that an agent can read and cannot
change. `/lesson/agent` builds on that bridge:

- `tutorTools({ agent, lesson, locale, article, answers })` returns tools a model can call: `read_outline`,
  `read_place`, `set_param`, `set_params`, `show_state`, `go_to_beat`, `next`, `previous`, `play`, `pause` and
  `inspect_figure`. Each has a name, a description, an `inputSchema` as JSON Schema and an async `run` that returns a
  plain result.
- `answerSources(articleOutline(children))` from `/article` maps each `Predict` that takes its answer from a lesson
  value (`answerFrom`) to that value. Pass it as `answers`, and the tools leave the value out until the reader commits.
- `createLearnerTrace` records what the reader did, and `summarizeTrace` writes it as plain facts for a tutor prompt.
  Changes an agent makes are left out.
- `playTour` plays a list of steps (`beat`, `step`, `state`, `values`, `say`, `hold`) through the bridge and pauses when
  the reader acts. `validateTour` checks a tour against its lesson, and `tourFromTrace` turns a recorded demonstration
  into one.

```ts
import { createAgent } from '@mechane-ai/elements/agent';
import { answerSources, articleOutline } from '@mechane-ai/elements/article';
import type { LessonTour } from '@mechane-ai/elements/lesson/agent';
import {
  createLearnerTrace,
  playTour,
  summarizeTrace,
  tutorTools,
  validateTour,
} from '@mechane-ai/elements/lesson/agent';

const agent = createAgent();
const title = 'Why a bigger batch is quieter';

// `essay` is the node passed as the children of the `Article`.
const answers = answerSources(articleOutline(essay));
const tools = tutorTools({ agent, lesson, locale: 'en-US', article: title, answers });
const trace = createLearnerTrace({ agent, lesson, article: title });

const tour: LessonTour = [
  { beat: 'noise', state: 'four', say: 'Four examples give a noisy gradient.', hold: 'regular' },
  { beat: 'noise', values: { batch: 64 }, say: 'Sixty-four examples cut the noise to an eighth.', hold: 'long' },
];

const findings = validateTour(tour, lesson);
const player = playTour({ agent, lesson, tour, onSay: (line) => console.log(line) });
const facts = summarizeTrace({ record: trace.read(), lesson, locale: 'en-US', answers });
```

A tutor model calls `tools[0].run()` to read the outline and the others to act. The model never receives a `Predict`
answer before the reader commits it. The
[teaching guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-teaching.md) has the full
reference for every entry.

## Develop and release

From `workspaces/core`:

```sh
pnpm --filter @mechane-ai/elements storybook
pnpm --filter @mechane-ai/elements build
pnpm --filter @mechane-ai/elements build-storybook
```

The component catalog belongs to Elements. Console keeps its application screen examples separately. Both compile the
same source components and use synthetic inputs. The
[component guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/components.md) explains
composition, supported states, and browser review. Stories are documentation; they do not create an automatic assertion
suite.

Internal families live in `packages/` and share one manifest. Its explicit exports drive the build and compiled
publication paths. Contracts check family dependencies, public entries, token ownership, and renderer confinement.
Private helpers remain private. Mechane installation releases and Elements releases have independent versions.

The public repository publishes immutable `elements-vVERSION` releases through `publish-elements.yml`. The workflow
rebuilds the reviewed archive, checks its digest, and uses npm trusted publishing with provenance. Package owners
establish that trust once; routine releases need no interactive login or stored npm token.

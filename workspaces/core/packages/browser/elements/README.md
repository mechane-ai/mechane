# Elements by Mechane

React components for applications, AI interfaces, and analytical graphics. Elements combines compact typography, square
surfaces, shared visual tokens, and accessible interactions. Mechane's Console consumes the same package. Components
receive values and callbacks; applications own routing, data, identity, and persistence.

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
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Details</Dialog.Title>
          <Dialog.Description>The application supplies this content.</Dialog.Description>
          <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
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

| Entry                  | Responsibility                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Root                   | Buttons, text, surfaces, disclosure, avatars, and CopyValue.                        |
| `/forms`               | Fields, inputs, selection, appearance picking, file picking, and settings sections. |
| `/forms/dates`         | Civil-date calendars and range selection.                                           |
| `/overlays`            | Dialog, Drawer, Menu, Popover, Preview, Tooltip, and AlertDialog.                   |
| `/feedback`            | Async regions, skeletons, progress, meters, notices, empty states, and toasts.      |
| `/navigation`          | Tabs, page navigation, breadcrumbs, skip links, and shortcut labels.                |
| `/navigation/commands` | Command palette and scoped application-owned shortcuts.                             |
| `/layout`              | Application shell, sidebar, toolbars, compound record pages, and resizable panes.   |
| `/collections`         | Tables, inspectors, collection controls, timelines, metrics, and timestamps.        |
| `/content`             | Trace, JSON, recorded logs, and stack traces.                                       |
| `/content/link`        | Safe content links without a renderer dependency.                                   |
| `/content/markdown`    | Completed and streaming Markdown, embedded headings, and inert previews.            |
| `/content/code`        | Source-preserving code highlighting.                                                |
| `/content/diff`        | File changes and patches.                                                           |
| `/content/tree`        | File paths, statuses, and controlled selection.                                     |
| `/ai`                  | Conversations, messages, prompts, approvals, sources, and citations.                |
| `/charts`              | Shared frames, legends, selection, and category types.                              |
| `/charts/cartesian`    | Lines, areas, sparklines, small multiples, bars, and scatter plots.                 |
| `/charts/distribution` | Histograms, cumulative distributions, intervals, and ranked values.                 |
| `/charts/matrix`       | Matrices, token heatmaps, and color legends.                                        |
| `/charts/graph`        | Supplied relationships and node selection.                                          |
| `/charts/hierarchy`    | Treemaps.                                                                           |
| `/charts/timeline`     | Waterfall intervals and instants.                                                   |
| `/theme`               | Light and dark theme props.                                                         |
| `/csp`                 | Application-supplied content security policy configuration.                         |
| `/tokens`              | Compiled token references for runtime styles.                                       |
| `/tokens.stylex`       | Variable definitions for StyleX authoring and themes.                               |
| `/constants.stylex`    | Compile-time conditions, palette values, layers, and shared geometry.               |
| `/styles.css`          | Component styles and token defaults.                                                |

Focused entries keep renderer and chart dependencies out of basic controls. There is no all-components barrel. Renderers
initialize when used, without a consumer-managed worker pool or grammar CDN. The
[content guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-content.md) explains assets,
input limits, and readable fallbacks.

## Composition and themes

Use Base UI's `render` composition and named variants for appearance. Native attributes, events, and refs remain
available. Typed `xstyle` inputs permit placement styles compiled by the application's StyleX setup. Applications own
asynchronous work and pass its pending, success, or failure state to controls.

Use `ToolbarAction` for page-header actions, including links composed with `render`. A clipboard action can compose
`CopyValue render={<ToolbarAction />}`; the rendered control owns its appearance and CopyValue owns copy feedback. Use
`Row` for aligned inline actions, `Stack` for related content, and `RecordPage.Content` for separated page sections.
Detail titles wrap; list metadata truncates. Sidebar items share contiguous hit areas. Supply `AppShell` with a
`NavigationRail` in its `rail` slot for persistent area links. It occupies 48px of the 240px navigation budget beside a
192px contextual sidebar. Collapsing hides the contextual sidebar and retains the rail. The phone drawer renders those
area links with visible labels above its pages. Its width, toolbar height, and footer cell share the same 48px geometry.
Put a `NavigationRailMenu` in `railFooter` for a pinned icon menu beside the desktop rail and above the phone drawer's
bottom-left control. Applications supply the menu content and actions. `Avatar` supports `shape="circle"` for an
initials or photo trigger. Applications supply selection, URLs, native link handlers, and action callbacks. Omit the
rail for a sidebar that collapses to page icons. `SidebarFooter layout="navigation"` holds persistent controls in the
contextual sidebar and reserves their intrinsic height while its pages scroll independently.

Navigation closes the mobile drawer and preserves focus set by the destination. Use
`NavigationItem shouldCloseOnActivate={false}` for menu triggers.

`AppShell shouldFocus` temporarily hides navigation while retaining its expansion state. `ViewStack.Panel` keeps
inactive content mounted and measurable but removes it from keyboard and assistive-technology navigation. The
application owns which view is active and when to unmount it; use this for a draft or reading position that must survive
inspection. `WorkbenchScroll` requires an accessible `label`; its `isFlush` mode leaves list insets to the table. Its
`scrollRestorationId` identifies the actual scroll region for application-owned restoration. Layout wrappers leave
sequential keyboard navigation to their controls. Tables and viewers add a named scroll stop when overflow needs one.
Interactive Cartesian charts have one Tab stop, a local datum cursor, and arrow-key inspection. Enter or Space activates
supplied selection; Escape dismisses details while retaining the cursor.

`Workbench` accepts an optional `inspector={{ label: 'Workspace', content: <WorkspaceFiles /> }}`. The application
supplies the accessible name with the panel content and owns opening, closing, and focus restoration. The inspector
replaces the main column at compact widths while keeping that column mounted.

Each `DataTable` column declares a role: `primary`, `text`, `status`, `number`, `timestamp`, or `actions`. Roles own
alignment and minimum sizing; the primary column uses available space. Headers and placeholders follow the same
geometry. The table uses 48px rows by default and truncates text to preserve stable column and virtualization geometry.
Set `rowSizing="content"` for records that need multiline cells; virtualization then measures those rows. Long content
belongs in a detail view or a deliberately content-sized row, not behind a clipped control. Use `DataTableText` for a
primary string and optional secondary string inside one cell; both text elements own their ellipsis. Arbitrary nested
layouts do not inherit text truncation. Give dates and numeric values sufficient column width or explicit content
sizing. The table owns its cell insets, so an enclosing page should not add another gutter around its rows.
`CollectionEnd` renders nothing when complete unless an explicit summary is supplied. `Timeline.Root` and
`Timeline.Item` compose readable activity with supplied titles, icons, timestamps, metadata, and body content, without
interpreting domain events.

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
Use `isLoading` and `hasDetail` to reserve its value and qualification while the application loads data. Full charts
accept `report={{ meta, summary }}` to place period metrics between a shared `SectionHeading` and the plot. Bar and
time-series charts also accept `report={{ meta, seriesValues }}`, a map of formatted period values keyed by series
identifier. It reuses their labels and colors as the legend. Undefined values reserve loading space. `SmallMultiples`
aligns date axes and inspection across panels, with one date axis at the bottom; its placeholder accepts the same report
layout without observations. The application owns periods, aggregates, coverage and read state. Keep full-width tables
outside `PageContent` so their cell insets remain the only gutter. `ReportContent` owns the inset for its optional
`summary` and leaves its `breakdown` full width. Pass summary content directly; omit it when a section contains only
rows. Absent, `null` and `false` summaries reserve no empty space. `ContentTabs` uses `defaultSelectedId` for an initial
local choice or `navigation` for application-controlled links; the two modes are mutually exclusive. `SettingsSection`
keeps wide tables inside their scroll region, and `SettingsRow` aligns labels and controls. Use `isPlaceholder` on a
decorative row without a control ID; ready rows require a real `controlId` for their label. `FormActions` owns
submission rows and their internal spacing. The enclosing section owns the gap before and after the actions.

The default theme is light, with system fonts and a compact spacing scale. Import `themeProps` from
`@mechane-ai/elements/theme` and spread `themeProps.light` or `themeProps.dark` onto the document root. Portaled content
then inherits the same theme. The application owns the preference; no theme provider is required.

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
`@mechane-ai/elements/csp` and pass the same request nonce used in its policy. Preserve that nonce during hydration.
This is [Base UI's CSP provider](https://base-ui.com/react/utils/csp-provider); it authorizes component style tags such
as Select's scrollbar rules. The application owns nonce generation and its security policy.

Mount one `Toaster` from `/feedback` and call its exported `toast` API for notifications. Elements includes Sonner's
structural styles in the published stylesheet, so the production package injects no additional toast style tag. Keep
initial-read failures and field validation local; retained-content refresh failures can use one notification with Retry.
The application owns stable notification IDs and dismissal on recovery or navigation.

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

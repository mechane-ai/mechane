# Mechane design system proposal

Status: accepted, November 3, 2026. This records the initial design and adoption decisions behind Elements by Mechane
and its Console consumers. The later [UI expansion](ui-capability-proposal.md) supersedes the source layout and
Console-consumer prerequisite below. The [component guide](components.md) describes supported APIs, and the
[Console guide](console.md) describes the shipped application. The collection API has since consolidated comparable
records on `DataTable`; the proposed `Table` parts below are retired.

The design system should make a new screen feel like the rest of Mechane with little custom styling. Controls share
interaction behavior, typography, spacing, and states. Layout and chart components remain useful without importing
Mechane resources, authentication, or network clients.

## Package ownership

```text
packages/browser/
  ui/src/          Accessible controls, forms, feedback, and visual tokens
    layout/        AppShell, Sidebar, PageToolbar, and page layouts
    charts/        Generic visx Waterfall and chart conventions
  console-views/   Mechs, turns, traces, workspace switching, and domain formatting
  console-data/    API requests, TanStack DB, query state, and command receipts
  console/         TanStack Start routes, application composition, and Storybook runner
```

`@mechane-ai/elements` is one independently versioned package. Tokens depend on StyleX; controls own Base UI
integration. Its `layout` and `charts` modules consume tokens and controls without depending on each other.
`console-views` combines them with Mechane records. `console` connects those views to `console-data` and routing.

The public name is **Elements by Mechane**, installed as `@mechane-ai/elements`. Its root exposes controls; `/layout`,
`/charts`, `/tokens`, and `/styles.css` expose the other cohesive surfaces. Keep one source package in this repository
and publish compiled ESM, declarations, and CSS with independent `elements-v` releases. Workspace consumers build the
same source. Ordinary external React applications need no StyleX compiler. The direct `/tokens.stylex` export supports
applications that author StyleX themes and placement styles. The
[package README](../packages/browser/elements/README.md) owns installation and customization guidance.

A future `@softmax/design-system` may wrap Elements by Mechane for its own branding and compositions. Softmax
applications would import only that adapter. This extraction makes no Softmax code or deployment changes.

Keep normal named package exports. Group files by their component family when several files share a responsibility;
avoid a folder containing only an implementation and a forwarding index. Use one maintained implementation of each
component, with no copies inside screen folders.

Tokens need a direct definition export, such as `@mechane-ai/elements/tokens.stylex`, resolving to
`src/tokens.stylex.ts`. StyleX requires direct imports from the defining file. Validate resolution in both the
application and Storybook compiler before moving every consumer. CSS variable references are not numeric inputs for visx
geometry. [StyleX variable imports](https://stylexjs.com/docs/learn/theming/using-variables/)

Sidebar geometry belongs to `elements/layout`. A workspace switcher and Mechane branding belong to `console-views`.
Generic text, table cells, copy controls, and metrics belong to `ui`. The request timeline becomes a generic Waterfall
in `ui/charts`, with request labels and evidence mapping in `console-views`.

## Component coverage

The catalog below describes useful coverage, not a requirement to implement every entry immediately. Add each exported
component with its first product consumer. Existing controls, selectors, forms, shell, and trace views provide the first
consumers. Specialized interactions need a concrete workflow before becoming maintained production code.

| Family                      | Proposed components                                                                               | Adoption boundary                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Text and visual foundations | Text, Heading, Link, Badge, StatusIndicator, Separator, Kbd                                       | Consolidate current typography and status presentation. Add shortcut presentation with an actual shortcut.             |
| Actions                     | Button, IconButton, Toggle, ToggleGroup                                                           | Standardize existing actions first. Add toggles when a view offers persistent choices.                                 |
| Fields                      | Field, Fieldset, Input, Textarea, NumberField                                                     | Improve create/edit forms, descriptions, and field errors. Numeric controls follow a typed numeric setting.            |
| Choices                     | Select, Combobox, Checkbox, RadioGroup, Switch                                                    | Extract the existing workspace Select first. Add other controls with filtering or settings workflows.                  |
| Overlays                    | Dialog, AlertDialog, Drawer, Menu, Popover, Tooltip                                               | Share the current drawer and selector conventions. Add reusable overlay behavior where actions and inspectors need it. |
| Feedback                    | Alert, EmptyState, Skeleton, Spinner, Progress, Toast                                             | Keep initial loading, stale content, inline errors, and receipts distinct. Progress requires recorded progress.        |
| Navigation and layout       | AppShell, Sidebar, PageToolbar, DetailPage, Breadcrumbs, Tabs, Stack, Row, Grid                   | Migrate the existing frame and page patterns. Route state stays in the application.                                    |
| Data presentation           | Table parts, CursorPagination, KeyValueList, CopyValue, CodeBlock, Metric, Collapsible            | Reuse current list and evidence views. Code rendering accepts bounded text; domain formatting stays outside UI.        |
| Charts                      | ChartFrame, Legend, chart tooltip presentation, Waterfall; later line, area, and bar compositions | Migrate the existing waterfall. Add trend charts when an API supplies meaningful aggregate data.                       |

A calendar/date-range picker, command palette, context menu, resizable panes, virtualized collection, rich text editor,
file uploader, or graph editor belongs to a later workflow. Use upstream behavior where possible when one is needed. For
example, a time-range control can start with presets rather than a calendar subsystem.

Keep one name for each concept. Use Base UI's `Menu`, `Drawer`, and `Popover` vocabulary. Avoid simultaneous aliases
such as Sheet and Drawer for the same component. A plain semantic Table and an interactive data-table composition have
different jobs; they can share cells and headers.

## Component API

Simple controls use direct props. Components with several interactive parts retain Base UI's part names, including
`Root`, `Trigger`, `Popup`, `Title`, and `Description`. Preserve native props, refs, and the upstream controlled/default
state options. Preserve event details instead of reducing every callback to a generic `onChange`.
[Base UI customization](https://base-ui.com/react/handbook/customization)

Use `render` for composition. Styled wrappers must preserve incoming event handlers, refs, classes, and styles. Apply
Mechane's StyleX styles through a documented merge policy. Use Base UI's existing composition helpers where appropriate;
do not build a general component factory. A composed tooltip and dialog trigger is a useful browser acceptance case.
[Base UI composition](https://base-ui.com/react/handbook/composition)

An illustrative field API:

```tsx
import { Button, Field, Input } from '@mechane-ai/elements';

<Field.Root name="name">
  <Field.Label>Name</Field.Label>
  <Input required value={name} onChange={(event) => setName(event.target.value)} />
  <Field.Description>A name people can recognize.</Field.Description>
  <Field.Error />
</Field.Root>

<Button variant="solid" pending={saving} pendingLabel="Saving…">
  Save
</Button>
```

Field owns label, description, and error association. Input retains native input behavior. Application code owns the
draft, submission, and server error mapping. Base UI forms can work with native validation and an optional form-state
library; the design system does not need its own form schema language.
[Base UI forms](https://base-ui.com/react/handbook/forms)

For controls, start with a small vocabulary:

| Concern                   | Proposed API                              | Meaning                                                                                       |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Visual emphasis           | `variant="solid\|outline\|ghost"`         | How prominent the control appears. A neutral solid action matches the current primary button. |
| Action meaning            | `tone="neutral\|danger"`                  | Normal or destructive intent, independent of emphasis.                                        |
| Control size              | `size="sm\|md"`                           | Shared compact and standard geometry. Toolbar cells remain a layout concern.                  |
| Pending action            | `pending`, `pendingLabel`                 | Stable geometry, an announced busy state, and prevention of duplicate activation.             |
| Icon-only action          | IconButton with required accessible label | Consistent icon placement and a name independent of its tooltip.                              |
| Selected/open/value state | Upstream state and change props           | The same control works with local state or application-controlled state.                      |

These are separate concepts, not a promise of every possible combination. Support combinations used by actual consumers.
A navigation Link renders an anchor; Button remains an action. Styling does not change that distinction.

Provide a typed `xstyle` escape hatch only where composition needs layout adjustment. Keep native `style` and
`className` usable by upstream composition. Visual variants remain the normal way to choose appearance. Use StyleX's
type restrictions to narrow an override when a component depends on fixed geometry.
[StyleX principles](https://stylexjs.com/docs/learn/thinking-in-stylex/)

## Visual and interaction consistency

Preserve the Console's current visual baseline: a 240-pixel expanded sidebar, a 48-pixel toolbar, compact table rows,
13/20 UI body text, and the existing heading hierarchy. Encode the shared choices as named roles. Keep the phone's
two-line rows and larger targets usable rather than forcing desktop row heights everywhere.

Tokens cover surfaces, text, borders, focus, semantic status, spacing, type roles, control sizes, radii, and motion.
Shell-specific measurements remain with the layout owner. The shell owns its outer separators; child actions own only
their internal dividers. This makes a continuous toolbar border independent of which actions a screen supplies.

Keep Lucide as the icon set. Shared controls own icon alignment and use common size and stroke choices. A second icon
registry would duplicate the dependency's API without improving the current screens.

Use the same states across applicable controls: hover, keyboard focus, disabled, pending, selected, invalid, and open.
Loading placeholders preserve layout. Inline errors explain how to recover. A transient refresh failure retains the last
authorized result; an access or workspace change clears it through the data owner.

Keep frequent keyboard interactions immediate. Small pointer transitions can use shared durations and origins. Reduced
motion removes decorative movement. Menus and dialogs manage focus through Base UI. Empty and unavailable states remain
readable at narrow widths, at zoom, and with long names.

Implement the current light theme completely first. Semantic tokens allow later themes without promising an unreviewed
dark mode or a runtime theme editor.

## Tables and charts

Keep Table parts semantic and usable without a table-state dependency. Resource views own columns and cell formatting.
For advanced sorting, selection, visibility, or expansion, use TanStack Table's types and composition. Add reusable
header or pagination pieces only when they have consumers. A universal options object should not replace normal JSX.
[shadcn table guidance](https://ui.shadcn.com/docs/components/base/data-table)

TanStack Table and TanStack DB solve different problems. Table owns interaction and row presentation; DB belongs to the
data layer. Server sorting, filtering, and pagination must cover the server's dataset. A cursor-based endpoint does not
imply known page counts. Do not silently sort one fetched page as though it were the whole result.
[TanStack processing guide](https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side)

The chart package owns axes, typography, legends, color, tooltip presentation, responsive measurement, and keyboard
equivalents. Start with the existing visx modules. Consider `@visx/xychart` when repeated Cartesian charts justify it.
Keep the domain outside the chart API.
[visx XYChart](https://github.com/airbnb/visx/blob/master/packages/visx-xychart/README.md)

Waterfall accepts explicit interval, point, and unavailable geometry, with labels and controlled selection. A
`RequestWaterfall` composition maps Mechane requests into those records. It owns refusal labels, links, timing units,
and the distinction between settlement and inference time. Unknown values remain unknown; a missing endpoint must not be
replaced with the current time to fabricate a completed duration.

Shared chart conventions include units, date/time formatting inputs, sparse data, zero values, unavailable data,
loading, and a textual way to inspect the same evidence. Avoid adding a chart plugin system or a generic visualization
schema. Trend charts need an aggregation API when the current paged records cannot answer the intended question.

## Storybook and contributor documentation

Extend the existing Storybook runner instead of introducing another application. Keep component stories beside their
owner, outside production entry points. Screen stories continue to compose the real shell and resource views. Storybook
discovery and the existing rule registry must agree about those file roles.

Organize stories into Foundations, Controls, Forms, Overlays, Layout, Data, Charts, and Screens. Each component's
examples show its normal use and the states it supports. Include long content, a narrow viewport, keyboard focus,
pending behavior, and errors where applicable. Provide one recommended composition before advanced options.

Use the accessibility addon during review and manually inspect keyboard order, announcements, and focus restoration.
Automated checks do not establish complete accessibility. Keep reusable stories without requiring a permanent play
assertion for every state. Retain automated interaction checks only for a consequential gap in existing coverage.
[Storybook accessibility](https://storybook.js.org/docs/writing-tests/accessibility-testing)

Public documentation explains the components through Mechane-owned examples. Keep private reference screenshots and
research outside the public export. The component catalog describes availability honestly; planned components are not
documented as callable exports.

## Contracts and enforcement

Keep the current package, export-consumer, and browser boundaries. Contract 113 continues to own session isolation,
bounded reads, route state, trace evidence, and the shared local/cloud release. Move UI-specific rules into focused
contracts as the new package owners are implemented. Proposed rules become requirements only with working code.

| Invariant                                                                       | Owning check                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| UI imports no Mechane protocol, session, storage, or network implementation.    | Declared dependency edges and dependency-cruiser. Keep Base UI and visx imports with their UI owners.        |
| Shared visual roles have one owner; interactive wrappers preserve composition.  | TypeScript, focused syntax checks where stable, and browser review of compiled styles and composed controls. |
| Every production export and dependency has a real consumer.                     | Existing knip checks in both modes. Stories alone do not justify unused product APIs.                        |
| Charts and collection views preserve the scope and uncertainty of their inputs. | Existing console evidence contract, reviewed adapters, and representative browser scenarios.                 |
| Each implemented component has discoverable usage and state examples.           | Storybook build, component review, and public contributor documentation.                                     |
| The exported source builds the same Console for local and cloud installations.  | Existing release asset, package, public-export, and runtime checks.                                          |

### Upstream baseline and scope

Use tenet-contracts v13.0.1, the latest published release checked on November 3, 2026, at
`01e7ac85f524a5446d04941e7db895af0b24f817`. Its required Tenet 0.11.0 matches the repository's existing tool pin. The
current lock records 70 contracts at v11.0.0 and three at v11.1.0. The release is a source for deliberate adoption; it
does not replace the repository's current requirements automatically.
[Release](https://github.com/macromackie/tenet-contracts/releases/tag/v13.0.1) ·
[Upgrade notes](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/CHANGELOG.md)

Compare the previous upstream text, current upstream text, and installed local text for each existing contract being
updated. Review the v12 and v13 changes separately. Preserve the accepted adaptations for cohesive modules, ordinary
React, browser Promises, and consequential testing. Update source pins only for copies actually reviewed and reconciled.
Record deferred requirements and the reason for each local difference in the adoption record.

Keep adopted UI contracts in `workspaces/core/.contracts`, using the next available imported-contract numbers below 101
and precise `paths`. Keep local additions in the existing 101-and-up range. The index can group UI rules together
without renumbering unrelated contracts or creating a second discovery mechanism.

The following is a proposed adoption map. Each row lands with the implementation that meets it; it is not an assertion
that today's source already complies. The names link to the reviewed upstream revision.

During a staged migration, scope a new rule to the implemented families and name that baseline explicitly. Expand its
paths as the remaining consumers migrate. At completion, review the full intended scope and remove temporary adoption
boundaries; a favorable review of the changed files alone does not establish library-wide compliance.

| Contract                                                                                                                                                                                    | Proposed scope                                         | Main obligation                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [ui-presentation-boundaries](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-presentation-boundaries/CONTRACT.md)                 | `ui`, `elements/layout`, `ui/charts`                   | Render supplied inputs and report intent; import no resource, routing, or data implementation.             |
| [ui-design-tokens](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-design-tokens/CONTRACT.md)                                     | Shared tokens and authored browser styles              | One owner for shared visual decisions; exhaustive named variants; structural geometry stays local.         |
| [ui-react-typescript-component-apis](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-react-typescript-component-apis/CONTRACT.md) | Public UI component declarations                       | Finite supported choices, required labels, typed records, and rejected incompatible modes.                 |
| [ui-control-accessibility](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-control-accessibility/CONTRACT.md)                     | Controls and their browser compositions                | Native semantics, explicit names, keyboard operation, and library-owned overlay focus.                     |
| [ui-react-interaction-ownership](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-react-interaction-ownership/CONTRACT.md)         | Interactive React components and hooks                 | One state/lifecycle owner, stable identity, and cleanup that cannot affect a newer interaction.            |
| [ui-presentation-state](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-presentation-state/CONTRACT.md)                           | Resource views and application-owned selections/drafts | Supplied collections keep their meaning; refresh and failed saves preserve edited drafts.                  |
| [ui-async-read-states](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-async-read-states/CONTRACT.md)                             | Resource rendering and read-state presentation         | Pending, failed, ready, and stale results stay distinct without flashing or displaced content.             |
| [ui-deterministic-display-values](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-deterministic-display-values/CONTRACT.md)       | Resource formatting and shared value displays          | Explicit formatting inputs, stable identity, and distinct zero, missing, and unavailable values.           |
| [ui-motion-lifecycle](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-motion-lifecycle/CONTRACT.md)                               | Components that animate                                | Immediate input/error state, interruptible transitions, reduced motion, and owned cleanup.                 |
| [ui-component-usage-guidance](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-component-usage-guidance/CONTRACT.md)               | Public components and their catalog guidance           | Purpose, recommended composition, and consumer responsibilities beside the component.                      |
| [ui-storybook-component-checks](https://github.com/macromackie/tenet-contracts/blob/01e7ac85f524a5446d04941e7db895af0b24f817/contracts/ui-storybook-component-checks/CONTRACT.md)           | Component stories and Storybook configuration          | Synthetic meaningful states, the application compiler, and explicitly selected consequential interactions. |

Scope presentation purity to the generic libraries. Mechane resource views may continue to use shared Mechane types
under contract 113; adopting it must not force a duplicate model for every API record. Keep intrinsic option matching
inside the adopted selection primitive distinct from filtering or sorting a server collection.

Add `ui-data-tables` with the first interactive DataTable consumer. Keep rows already ordered and paged by the
application, with controlled sort and cursor state. Keep TanStack Table types inside that optional adapter; ordinary
Table parts retain native composition. The current library does not need a new table engine just to adopt a contract.

Add `ui-time-series-charts` with an actual line/area chart and its data source. Its timestamp and series requirements do
not describe overlapping request intervals, so it must not govern Waterfall. Add `ui-keyboard-shortcuts` when
application commands exist; native menu and tab behavior already belongs to the control library.

### Deliberate adaptations

Record these decisions under `Local adaptations`, quoting the upstream clauses they replace when adoption occurs:

| Upstream restriction                                                    | Proposed Mechane adaptation                                                                                                                                                             | Reason                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public prop types exclude third-party UI types.                         | Allow types derived from the chosen Base UI primitives and React native attributes. Keep query, database, transport, and visx implementation types out of generic UI props.             | Preserve refs, event details, generics, and upstream composition without manually copying every native prop. |
| Public components reject unrestricted style inputs.                     | Make named variants and constrained root placement the application API. Preserve class/style transport needed by Base UI composition; application code may not restyle internal states. | A trigger must keep injected classes and positioning while the design system retains visual ownership.       |
| A catalog exposes generated agent-query metadata and a query interface. | Use ordinary Storybook documentation and story metadata initially. Add a supported upstream query integration only with a real consumer.                                                | The catalog should not require a custom registry, metadata service, or parallel source of truth.             |
| API choices include a finite icon-name catalog.                         | Keep the adopted Lucide vocabulary and shared sizing. Introduce an icon-name registry only if a feature accepts icon names as data.                                                     | Current screens do not need another name mapping over Lucide.                                                |
| Pending view headings, actions, and content reveal together.            | Render the neutral public shell immediately; reveal each independently authorized resource region with its own state.                                                                   | Preserve the existing initial render and independent resource reads without showing invented permissions.    |
| Stories may add plays for a primary interaction.                        | Every retained play must also meet Mechane's consequential-regression retention rule and use an approved runner.                                                                        | A primary interaction alone is insufficient justification for a permanent test.                              |

The independent-reveal adaptation above was superseded by the November 5, 2026 loading decision. Contract 071 now
coordinates a page's heading, actions, and primary content under one loading clock. Optional reads remain independent.
The [visual system guide](visual-system.md#loading-without-movement) describes the accepted presentation.

Mechane-owned interactive controls reject mixed controlled/default values and require their change callback. Preserve
explicit read-only modes where the upstream control supports them. Exercise invalid prop combinations with temporary
compiler probes; retain a compile-time assertion only for a consequential gap under the same test-curation policy.

Keep native Input events and Base UI's typed change callbacks. Do not adopt `ui-semantic-value-controls` wholesale: its
requirement to replace raw events with domain-value callbacks would add another control protocol here. Carry useful
empty-value and form-reset behavior through the adopted control/accessibility requirements.

Do not adopt `ui-react-typescript-jsx-attributes` or `ui-react-hook-calls` for this pass. Their blanket prop-spread ban,
mandatory string hoisting, memoization, and hook-category ordering conflict with the accepted React conventions. Use the
correctness rules from `ui-react-interaction-ownership` and existing lint instead.

### Local requirements

Write a focused `ui-stylex-composition` contract for the integration that generic upstream rules cannot establish:

- Tokens import through their declared `.stylex` definition export, with the compiler recognizing that package path.
- Styled controls preserve composed refs, accessible attributes, event callbacks, and required classes/styles.
- Named variants have exhaustive style maps. Placement overrides cannot change typography, focus, or disabled states.
- Supported StyleX longhands survive the production compiler. The existing `stylex-longhands` rule keeps one owner.
- Components have usable appearance in the catalog without application-specific global styles.

Its concrete failure example is a wrapper that spreads incoming props and then overwrites their `className` and `style`
with its own styles. Its behavior check composes a styled button with Tooltip and Dialog triggers, then verifies names,
keyboard activation, focus return, positioning, and merged styles in the built browser output.

Write `ui-waterfall-charts` for generic interval, point, and unavailable geometry. It requires one time scale, stable
row identity, controlled selection, and a textual way to inspect the same values. Unknown endpoints cannot manufacture a
completed bar. Contract 113 continues to define what Mechane's reservation and settlement timestamps mean.

Keep shell dimensions, outer-border ownership, list/detail layout, and the shared local/cloud release in contract 113.
Update its package map and remove its obsolete four-package count. Move generic obligations to their new owner rather
than copying them into multiple contracts. Neither proposed local contract requires a new testing framework.

### Static checks and Tenet review

Keep values and automatable rules in the existing registry, with generated configuration. Load applicable upstream
assets through it instead of copying checks. The design-token contract ships a StyleX variant-selection rule, and
interaction ownership ships React hook/index-key/effect rules. Confirm each fits the pinned compiler and linter before
enabling it. Retain the registry's small allowed/violation examples for a newly enabled rule.

Keep `dependencies.json`, dependency-cruiser, and knip as the existing owners of package edges and consumers. The
v13.0.1 dependency checker is optional; adopting its release does not require a second package inventory or scanner.
Extend the current file-role registry for colocated stories, preserving their default-export allowance and development
scope. Do not relax product entry-point rules to make story files compile.

Run `mise run contracts:check` for offline contract validation. Run the relevant compiler, lint, dependency, Storybook,
and production-build checks for implementation changes, followed by the existing complete check at integration. Document
validation does not establish behavioral compliance.

Model-assisted `tenet check` remains an explicitly requested, bounded review, outside normal CI. For a new or materially
changed contract, assess its full adopted scope; a diff assessment assumes the base already complied. Inspect findings
and incomplete coverage instead of treating an empty report as proof. No model request is needed to maintain the docs.

## Verification without test proliferation

The current `test-curation` and `test-assertion-integrity` rules remain the retention policy. Their upstream texts are
unchanged between v11.0.0 and v13.0.1. Mechane additionally keeps no unit suite or mocked product tests, and requires
maintainer approval for smoke catalog changes.

Extend those rules' scopes to cover browser stories, TSX, catalog configuration, browser verification fixtures, and
test-only dependencies. Currently test-curation names the smoke, testing support, and package manifests;
assertion-integrity names TypeScript but omits TSX. Document the distinction between maintained synthetic catalog
examples and disposable test fixtures. Catalog examples are developer documentation, not an adoption of
`test-example-suite`.

| Evidence                           | What remains in the repository                                                                     | What stays development-only by default                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Component states                   | Synthetic stories of meaningful supported states, grouped by component family.                     | Extra experiments and fixtures that duplicate those states.                                       |
| API and boundary guarantees        | TypeScript, existing dependency/export checks, and small examples for actual lint rules.           | A permanent type assertion or unit test for every prop, helper, or variant.                       |
| Visual polish                      | Shared tokens, reusable stories, and reviewable reference guidance.                                | Screenshot-diff suites, pixel assertions, and a viewport-by-theme-by-variant matrix.              |
| Accessibility                      | Semantic implementation, static checks, and catalog inspection tools.                              | Re-testing every Base UI key handler or turning every story into a CI test.                       |
| Consequential application behavior | Existing representative runtime coverage; a narrowly justified extension when coverage is missing. | Broad browser probes, exhaustive interaction scripts, and fixed sleeps used during investigation. |

A new retained check must name a consequential regression, show why existing coverage misses it, and assert the stable
user-visible outcome at its owning boundary. Relevant candidates include a lost draft, stale private data after a
workspace change, or a repeated submission with a second external effect. Their severity alone does not prove a new test
is needed; compare the existing coverage first.

The existing CLI/runtime smoke does not prove browser focus, layout, or client draft behavior. Exercise those through
the packaged local Console while developing. If one needs durable automated protection, propose the smallest approved
extension rather than installing a parallel browser suite. Keep existing consequential checks intact.

Do not add Storybook play tests or automatic test tags as a catalog default. If a retained play is justified later,
select it explicitly. Adding a story should add documentation, not silently increase CI work. The accessibility addon
can assist review without becoming an assertion suite for every visual state.

Before retaining a new check, introduce a temporary mutation of the behavior it guards and observe its failure. Remove
the mutation and temporary probes before committing. Keep no assertions of private helpers, CSS classes, incidental
copy, or exact animation timing, and impose no coverage percentage or test-count target.

## Reviewable implementation boundaries

Each boundary below should be independently reviewable and leave functioning consumers. Contracts, implementation,
stories, and generated checks change together. This is the proposed change structure, not a record of completed work.

| Boundary                        | Concrete result                                                                                                           | Acceptance evidence                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Foundation and composition      | Token package; shared Button, Field, Input, Select, Dialog, and Tooltip conventions; create/edit and workspace consumers. | Compiled token imports, preserved composed props, keyboard use, and one complete form with pending and error states.        |
| Shell and screen migration      | Shared AppShell, Sidebar, PageToolbar, DetailPage, typography, and table parts; old implementations removed.              | Consistent borders and measurements across existing routes, collapsed navigation, phone layouts, and long labels.           |
| Resource and trace presentation | One read-state projection at the existing resource boundary; preserved drafts; generic Waterfall and request adapter.     | Slow/failed/refresh reads, resource switches, pending/conflicting saves, and incomplete trace evidence rendered truthfully. |
| Catalog and public API          | Colocated component stories, public usage guidance, correct development file roles, and no unused exports.                | Catalog builds without services; meaningful states and composed controls work with the application compiler.                |
| Integrated release              | One public source export and compiled Console for local and cloud installation.                                           | Existing checks, a browser pass against the packaged celld Worker, release inventory checks, and bundle review.             |

Review the same representative screens against the saved visual baseline at matched viewport sizes. Compare border
continuity, typography, control alignment, spacing, and row density. Check narrow reflow and zoom separately from
desktop density. Values remain in their token owner; screenshots do not become another specification embedded in tests.

Use WCAG 2.2 AA text contrast as the baseline: 4.5:1 for ordinary text and 3:1 for qualifying large text, with its
stated exceptions. Review actual foreground/surface pairs in the supported light theme. Use a declared 44-pixel
coarse-pointer target for standalone controls as a Mechane design choice; this is stronger than the 24-pixel AA minimum,
which has spacing and other exceptions.
[Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) ·
[Pointer targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

The completion review should remove duplicate wrappers, unused exports, temporary checks, and unnecessary dependencies.
Confirm that no open finding concerns a lost result, incorrect trace, inaccessible primary action, or broken local/cloud
asset delivery. Report any narrower remaining verification gap with its scope instead of claiming universal coverage.

## Distribution and acceptance

These packages remain part of the open-source Mechane source tree and versioned Console release. A separate npm product
is unnecessary for the dashboard. If another repository later consumes the UI independently, qualify its CSS build, peer
dependencies, export surface, and release policy for that consumer.

Each package move updates `dependencies.json`, manifests, generated checks, compiler resolution, stories, and dependency
notices together. Confirm the public export includes those sources and notices. No private repository path or personal
configuration may be required to build them.

The same compiled assets continue to run through celld and Cloudflare. OpenTofu keeps installing the versioned Mechane
release. This work adds no frontend service, database, or installation setting.

Acceptance uses the current screens and real workflows: create/edit forms, workspace switching, navigation, request
selection, and copying evidence. Check desktop and phone layouts, keyboard-only operation, zoom, reduced motion, pending
commands, empty data, refresh failures, and long content. Inspect built assets as well as Storybook.

Keep chart and catalog code off the initial sign-in path unless a screen needs it. Review bundle changes after the
package split. Run the existing repository checks and runtime coverage; additions to the smoke catalog follow the
repository's existing curation policy.

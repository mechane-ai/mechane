# Mechane UI capability proposal

Status: accepted November 3, 2026. Scott requested the full expansion with one published package and internal modules.
The [component guide](components.md), family guides, and package exports describe the implemented API. This document
records the capability choices and their ownership, not a second API registry.

The library covers application controls, rich content, agent interfaces, and analytical graphics. Each area uses
Mechane's compact Tinker-inspired typography, spacing, borders, focus treatment, and color roles. Applications supply
records and commands. Components present those records and report interactions.

## Package boundaries

Everything ships in **`@mechane-ai/ui`**, with one version, stylesheet, npm archive, and trusted-publishing workflow.
Internal modules expose focused subpaths. They are source boundaries inside that package, not separate workspace or npm
packages.

| Entry                                                           | Responsibility                                                             | Implementation owner                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@mechane-ai/ui`                                                | Tokens, accessible controls, forms, feedback, and generic activity parts.  | Base UI, StyleX, and Lucide.                                       |
| `@mechane-ai/ui/layout`                                         | Application shell, navigation, toolbars, details, and split panes.         | Core controls and Resizable Panels.                                |
| `@mechane-ai/ui/collections`                                    | Tables, collection controls, commands, and date selection.                 | TanStack Table, Virtual, Hotkeys, and DayPicker behind owned APIs. |
| `@mechane-ai/ui/content`                                        | Markdown, structured values, and recorded output.                          | Core controls and a shared Markdown renderer.                      |
| `@mechane-ai/ui/content/link`                                   | Safe destinations independent of the Markdown renderer.                    | Shared content policy.                                             |
| `@mechane-ai/ui/content/code`, `/content/diff`, `/content/tree` | Source, changes, and file navigation.                                      | Pierre behind typed Mechane components.                            |
| `@mechane-ai/ui/ai`                                             | Conversations, prompt composition, agent activity, and maintained recipes. | Core, collections, and content. No model SDK or transport.         |
| `@mechane-ai/ui/charts` and its family subpaths                 | Temporal, categorical, distribution, matrix, and relationship graphics.    | Core tokens and selected visx modules.                             |

```text
workspaces/core/packages/browser/
  console/              TanStack Start and application composition
  console-data/         APIs, TanStack DB, query state, and commands
  console-views/        Mechane records and screen composition
  ui/                   @mechane-ai/ui
    packages/
      ai/src/
      charts/src/
      collections/src/
      content/src/
      core/src/
      layout/src/
    package.json
    vite.config.ts
```

The core entry imports none of the heavier families. Layout, collections, and charts depend on core. Content may use
core and collections. AI may use core, collections, and content. Applications compose independent families through
public entries. No area imports application records, routers, clients, or data stores.

Heavy renderers load when their surfaces are used. Subpaths isolate evaluated code, not installation dependencies; the
single npm archive includes all of its declared runtime dependencies. Package-consumer checks establish which chunks and
assets a consuming build actually loads. Ordinary React consumers need no StyleX compiler.

The existing `/layout`, `/charts`, and token imports remain in this package. Simple tables and inspectors move to
`/collections`, giving collection ownership one place. There is one Waterfall implementation. Internal folders appear
with real source; no package-per-component or general widget registry is introduced.

A future `@softmax/design-system` can expose selected Mechane components and Softmax-specific compositions. Softmax
applications would import that facade. This implementation includes no Softmax or Nexus source migration.

## General components

| Area                | Capability                                                                                  | API and ownership                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Existing foundation | Button, links, text, badges, fields, overlays, tables, layout, metrics and copyable values. | Retain their established names and composition model.                                                         |
| Selection           | Checkbox, RadioGroup, Switch, ToggleGroup, Combobox, searchable multiselect.                | Wrap Base UI parts; stable item IDs and controlled selection. Tags are a multiselect composition.             |
| Form composition    | Fieldset, InputGroup, NumberField, Slider, FilePicker.                                      | Preserve native forms, refs and events. Applications own validation policy and file upload.                   |
| Overlays            | Menu, Popover, AlertDialog, hover/focus preview and Toast.                                  | Reuse Base UI focus, dismissal and portal behavior. Actionable errors remain visible near their operation.    |
| Disclosure          | Collapsible and Accordion.                                                                  | Shared building blocks for metadata, source groups, tool output and settings.                                 |
| Navigation          | Breadcrumb, Kbd, command-palette composition, navigation groups.                            | Routing and command eligibility stay with the application. No second shortcut registry.                       |
| Feedback            | Skeleton, SkeletonText, Spinner, Progress and Meter.                                        | Distinguish loading, measurable progress, bounded capacity, and missing values.                               |
| Collections         | DataTable, collection toolbar, filter chips, column controls and pagination presentation.   | Supplied rows and controlled sort/page state. No API requests or implicit whole-dataset filtering.            |
| Details             | Existing Details and Inspector, settings rows, avatar, timestamp presentation.              | Generic labels and values; locale and time zone supplied by the application.                                  |
| Workspace layout    | Resizable split panes.                                                                      | A focused upstream resize primitive owns pointer and keyboard mechanics; layout persistence stays outside UI. |
| Time selection      | Range presets, Calendar and DateRangePicker.                                                | A shared date model with explicit time zone. DayPicker owns the calendar; Base UI owns the popover.           |
| Activity            | Trace rows with labels, status, optional details, links and nested groups.                  | One generic list/disclosure vocabulary for agent steps and audit activity.                                    |

The [Base UI catalog](https://base-ui.com/react/overview/quick-start) supplies behavior where a primitive exists.
[TanStack Table](https://tanstack.com/table/latest/docs/introduction) supplies internal table models.
[DayPicker](https://daypicker.dev/) and [Resizable Panels](https://react-resizable-panels.vercel.app/) are focused
owners for behavior outside Base UI's current public surface. Dependencies enter only with their owning feature.

Loading composes shared Skeleton parts. Table, chart, message, inspector, and form placeholders use the same parts.
Those compositions share their real layout geometry. A labelled loading region owns the announcement; decorative
skeleton pieces are hidden from assistive technology. Refreshes retain authorized content and avoid recreating a loading
screen.

Simple `Table` remains useful without sorting or virtualization. `DataTable` accepts prepared rows, stable keys,
columns, and controlled sort/selection values. The application owns the query and shareable URL state. Virtualization
addresses rendered rows, not API pagination. Grouped or unusual table structures compose low-level parts rather than
expanding DataTable into an option-driven layout engine.

Carousel, OTP input, a full rich-text editor, a live terminal emulator, and arbitrary workflow editing remain optional
future additions. Current evidence does not require them. One name per concept remains preferable: Panel does not need a
duplicate Card API, and Drawer does not need a Sheet alias.

## Content and Pierre

| Component  | Behavior                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| CodeBlock  | Filename/language, copy, wrap, line numbers, selected lines, annotations, and plain or streaming content.                      |
| DiffViewer | Unified or side-by-side review, old/new files or a patch, added/deleted files, hunks and line annotations.                     |
| FileTree   | Paths, folder expansion, selection, search, file status and virtualization. Read-only browsing is the initial surface.         |
| Markdown   | Shared typography, lists, tables, safe links and CodeBlock fences. Completed and streaming messages use the same presentation. |
| JsonViewer | Bounded nested values, expand/collapse, copy, and clear unavailable/truncated states.                                          |
| LogViewer  | Recorded output with ANSI sequences stripped for display, bounded rendering, follow/pause behavior and exact copy.             |
| StackTrace | Error summary and navigable frames composed from Trace and CodeBlock. The application supplies file destinations.              |

Use [Pierre Highlights](https://diffs.com/highlights) as the preferred supported-language highlighter and
[Pierre Diffs](https://diffs.com/docs) for file and patch rendering. Use actual
[Pierre Trees](https://trees.software/docs) behind Mechane's FileTree rather than rebuilding virtualization and keyboard
navigation.

Pierre integration has specific boundaries:

- Mechane owns the visible header, actions, density and tokens. Pierre owns lexing, diff geometry and tree mechanics.
- A small internal adapter maps Mechane CSS variables into Pierre's theme and Shadow DOM styling interface.
- Source appears as escaped text before highlighting loads. Unsupported languages and failed highlighting preserve that
  readable text. No external grammar service or CDN is required.
- Renderer modules include their WebAssembly assets in the consuming build. SSR emits plain source. Cloudflare and celld
  serve the same packaged assets; applications do not configure a worker pool.
- Streaming updates use incremental tokenization where supported. Changes to supplied source, file identity or an
  explicit revision reset renderer state. Large outputs use bounded or virtualized presentation.
- Trees has a persistent model: later path, status and selection changes must reach that model through its update
  methods. The wrapper preserves one selection owner instead of mirroring two competing state stores.
- Public props describe files, patches, paths and annotations. Ordinary consumers do not manipulate a Pierre model or
  configure a worker pool. There is no speculative interchangeable-renderer plugin API.

[Streamdown](https://streamdown.ai/docs) handles incomplete Markdown through Mechane's custom renderers and styles. Code
fences use Pierre through CodeBlock. The Nexus react-markdown integration informed completed-text presentation;
streaming fences and partial syntax use the shared content renderer.

Markdown and recorded output remain data. Links, raw HTML, images, ANSI control sequences and embedded content need
deliberate rendering policies. Secret redaction belongs before values reach the generic viewer. An iframe preview, if
later required, has an explicit origin and sandbox policy; an arbitrary JSX evaluator is outside this proposal.

## AI coverage through primitives and recipes

The current [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements) direction is composition. Mechane can cover the
same workflows through a smaller set of maintained behavior owners. A recipe is a documented composition of public
parts; it is not automatically another exported stateful component.

| Reference pattern | Mechane equivalent                                                    | Form                                                                      |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Chat              | Conversation, Message and a controlled PromptInput.                   | Public behavior families plus a complete screen recipe.                   |
| Message           | Author/content/actions, Markdown, attachments and activity slots.     | Public family.                                                            |
| Prompt Input      | Textarea, attachment presentation, model controls, send/stop actions. | Public composition with native form semantics.                            |
| Model Selector    | Searchable model list and independent effort/settings choices.        | Combobox/Menu recipe; application supplies availability and capabilities. |
| Suggestion        | Prompt action with a supplied callback.                               | Button-group recipe.                                                      |
| Tool              | Status, input, approval state and recorded output inside Trace.       | Agent activity family.                                                    |
| Reasoning         | Supplied explanation or reasoning summary, optionally streaming.      | Trace/Markdown composition; no fabricated internal reasoning.             |
| Chain of Thought  | Expandable summary of supplied steps.                                 | Nested Trace recipe.                                                      |
| Plan              | Intended steps with current progress.                                 | Task-list recipe.                                                         |
| Task              | Recorded execution steps and status.                                  | Trace recipe, distinct from intended plan data.                           |
| Queue             | Pending and completed items with application actions.                 | Grouped task-list recipe.                                                 |
| Subagent          | A nested run with steps and a result.                                 | Nested activity recipe; no agent spawning logic.                          |
| Confirmation      | Approve/deny controls for an identified pending request.              | Public approval presentation; server owns eligibility and outcome.        |
| Context           | Used/available capacity and a breakdown.                              | Meter/Popover recipe; unknown usage stays unknown.                        |
| Sources           | A list of source links with metadata.                                 | Shared citation/source family.                                            |
| Inline Citation   | Source marker with keyboard/touch-accessible preview.                 | Shared citation/source family.                                            |
| Checkpoint        | A conversation marker with restore/fork intent.                       | Trace/marker recipe; application owns the actual operation.               |
| File Tree         | Tree and selected file/diff content.                                  | Content-module composition.                                               |
| Terminal          | Command, output, exit status and timestamps.                          | Trace and LogViewer recipe; no shell transport.                           |
| Stack Trace       | Failure with frame inspection.                                        | Content component composed into Trace.                                    |
| Test Results      | Summary, suites, failures and output.                                 | Trace, Badge and CodeBlock recipe.                                        |

The individual [Chat](https://ui.shadcn.com/docs/ai-elements/base/chat),
[Prompt Input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input),
[Tool](https://ui.shadcn.com/docs/ai-elements/base/tool),
[Sources](https://ui.shadcn.com/docs/ai-elements/base/sources), and
[Subagent](https://ui.shadcn.com/docs/ai-elements/base/subagent) patterns provide concrete composition references. The
remaining named patterns are linked from the current catalog.

Conversation owns scroll anchoring and whether the reader is following the live edge. It preserves the reading position
when earlier history arrives or a response grows. Message IDs remain stable. Updates do not announce every token or
steal focus. Prompt submission respects composition input, supports multiline entry, and keeps the draft when submission
fails. Stop and retry are supplied commands with explicit pending state.

The UI package does not import AI SDK, TanStack AI, Pi Durable, Mechane client records, or a transport. A consumer can
map any of those onto the public presentation inputs. There is no second generic agent protocol in the UI package.
Examples may show integrations as application-owned code.

Legacy AI Elements also included audio, voice, workflow canvas, package/environment cards, artifact panels and web
previews. Artifact/metadata panels and native media controls can be recipes. Voice capture, full workflow editing,
provider chat launchers, and executable previews require their own concrete product use before becoming supported APIs.

## Charts and interpretability

The chart library has two layers: ready-to-use chart families and a small set of common presentation parts. ChartFrame,
axes, legend, value inspection, color legend and range selection share tokens and behavior. Selected visx modules own
geometry. The public surface does not mirror every visx primitive or introduce a chart-specification language.

| Family              | Surface                                                          | Concrete use                                                            |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Metric trends       | Sparkline, line and area charts.                                 | Latency, throughput, cost and token trends.                             |
| Aligned time plots  | Small multiples with shared time range and inspected timestamp.  | Tinker-style training and sampling metrics.                             |
| Additive series     | Stacked bars/areas, grouped bars, compact breakdown bar.         | Usage by model or operation; Nexus usage and DevEx periods.             |
| Space allocation    | Treemap with a readable breakdown table.                         | Tinker-style token/spend allocation.                                    |
| Duration evidence   | Existing Waterfall, with generic selected-row inputs.            | Requests, spans and concurrent steps.                                   |
| Distributions       | Histogram, ECDF and interval/quantile displays.                  | Latency spread, activation values, score distributions and comparisons. |
| Ranked values       | Horizontal bars and signed ranked-value rows.                    | Feature activations, token logits and contribution rankings.            |
| Matrix              | Heatmap with row/column labels, color legend and selected cell.  | Evaluation grids, correlation and attention.                            |
| Token values        | TokenHeatmap with exact text, indices and supplied scores.       | Attribution, activation, log-probability and loss inspection.           |
| Embeddings          | Scatter plot, brush/selection and a linked record inspector.     | Clusters, nearest neighbors and cohort comparison.                      |
| Graph relationships | Read-only lineage/attribution graph with selection and grouping. | Artifact ancestry and supplied feature relationships.                   |

Basic charts should land before specialized graphics. A histogram receives declared bins; an ECDF receives prepared
points. A scatter plot receives coordinates, rather than computing embeddings. Attention views receive indexed values,
masking and normalization information. No component calls a model, estimates missing measurements, or silently computes
domain aggregates from the visible page.

The interpretability compositions are:

- Feature inspection: ranked activations, a distribution, exact token highlights and related-feature records.
- Attention inspection: a matrix, head/layer controls and linked source/target tokens. Masked values remain distinct
  from zero; attention weights alone are not labelled causal explanations.
- Embedding inspection: selectable points, visible sampling/aggregation information, and a linked detail/table view.
- Experiment comparison: shared axes, explicit comparison groups, interval bands and signed changes.
- Attribution inspection: selected graph neighborhoods with token and feature detail panels. Layout and causal meaning
  come from the analysis source, not from an inferred arrangement of arbitrary events.

These proposals draw on [Neuronpedia](https://docs.neuronpedia.org/sparse-autoencoders/feature-dashboards),
[CircuitsVis](https://github.com/TransformerLensOrg/CircuitsVis), and
[Circuit Tracing](https://www.transformer-circuits.pub/2025/attribution-graphs/methods.html). They do not imply that
Mechane currently produces these datasets.

SVG is the initial renderer for bounded charts. Dense scatter plots and matrices need measured workloads before a Canvas
or WebGL renderer is selected. Aggregation and downsampling are explicit, with original values available for inspection.
A lineage view can use React Flow when a real graph consumer exists; it does not justify bundling a graph editor into
base controls. Flamegraphs, geographic maps, 3D plots and large circuit canvases remain later candidates.

## Public interface conventions

Simple components use direct props. Compound interactions preserve Base UI-style `Root`, `Trigger`, `Popup` and
`Content` parts where appropriate. Native props, refs, events and composition remain intact. New components use named
variants and constrained placement styles rather than arbitrary internal style overrides.

Presentation records have stable IDs. Selection is a value plus a callback; local disclosure and focus stay with their
interaction owner. Product data, permission checks, fetching, persistence and mutations stay outside the package. Chart
units, time zones, labels and formatting are explicit. A shared parent can link a selected token, matrix cell, file line
or chart interval across components without a global visualization store.

The [component guide](components.md) links to each implemented family's exported types and recommended stories. Those
sources own exact prop names and runnable compositions. The design boundary stays the same: explicit data, controlled
selections, ordinary form events, and no server client or application provider inside UI.

Trace expresses sequence and disclosure. Waterfall expresses intervals on a shared time axis. Graph expresses
relationships. Their distinct names keep evidence meaning clear.

## Visual consistency

Retain the established 48px toolbar, 240px desktop sidebar, compact 13/20px body scale, thin separators and restrained
radii. Chart titles, axes, legends, value inspectors and empty states become named roles on that same scale. Numeric
values use tabular figures; code uses a consistent mono role. The shared edge has one border owner.

Add semantic chart colors: categorical, sequential, diverging, missing, selected and annotation roles. A signed score
needs a declared midpoint; zero, missing and masked values must remain distinguishable. Category colors retain their
meaning across related views. Tooltips show exact supplied values, while axes may use an explicit compact formatter.

Light and dark themes should be validated as complete token sets before claiming Nexus presentation parity. Theme
preference and persistence belong to the application. Portals and Pierre's internal surfaces use the same chosen theme.
Dense desktop presentation retains suitable touch targets, visible focus and reduced-motion behavior.

## Contracts

Existing [UI contracts](../.contracts/index.md) already govern presentation boundaries, tokens, typed APIs,
accessibility, state ownership, loading, display values, motion, documentation and restrained Storybook checks. Their
scopes include the internal modules. Their browser and Base UI adaptations remain in force.

| Decision                 | Enforcement                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Package responsibilities | Declare allowed edges in the existing dependency registry; dependency-cruiser rejects reverse/application imports.             |
| Data tables              | Contract 076 adopts the upstream data-table requirements for prepared rows, controlled sort/page state and stable identifiers. |
| Time series              | Contract 077 adopts the upstream time-series requirements for explicit time, missing observations and equal inspection access. |
| Shortcuts                | Contract 078 adopts shortcut requirements; application owns bindings, eligibility and modal scope.                             |
| Recorded content         | Contract 116 covers safe text, copying fidelity, line coordinates and renderer asset ownership.                                |
| Streaming                | Contract 117 covers stable IDs, reading position, composition input and supplied command state.                                |
| Scientific displays      | Contract 118 covers units, masks, normalization, explicit transforms and honest color/axis semantics.                          |
| Tokens and composition   | Existing StyleX and API checks cover the shared density and preserved upstream composition behavior.                           |
| Public support           | Contracts 006 and 074 define support through the documented npm API, with private code still checked for actual use.           |

The public-support decision matters for a component library. A deliberate, documented library capability can be a
supported product before Console has a matching screen. The adopted exception applies only to explicitly supported
published entry points, with a concrete use case, public types, maintained examples and package-consumer verification.
Internal helpers and dependencies still require real use. An arbitrary wishlist, a story alone, or a dummy production
import would not justify an export. Console adoption remains additional integration evidence.

Tenet assesses the applicable decisions and reports findings and coverage gaps. Exact import, type and token rules use
the existing deterministic checks. Neither tool substitutes for reviewing charts, focus behavior or rendering fidelity.
There is no new parallel rule registry or checker for every prose guideline.

## Verification and publication

One Storybook catalog discovers all package-local examples. Each family has a recommended composition and meaningful
states: long content, empty, loading, error, narrow layout and keyboard use where relevant. Synthetic examples cover
streaming, diff/tree updates, missing chart values and linked selection. The catalog remains usable without Mechane
services or production records. Its public documentation uses Mechane examples, not authenticated Tinker captures.

Retained checks follow the existing [test-curation contract](../../../.contracts/001-test-curation/CONTRACT.md). Stories
do not acquire automatic play tests. No unit suite or product mocks are added. Temporary browser and compiler probes can
investigate broadly; permanent assertions need a consequential regression gap and an approved runner. Existing
smoke-catalog changes still require Scott's explicit approval.

Consequential verification includes composed control focus, scroll anchoring during streaming/history insertion,
composition-safe submission, faithful source copying, diff line identity, tree updates, and chart inspection across
pointer/keyboard/touch. A small set of packaged screens can exercise these together. It does not require a snapshot for
every component/variant combination or assertions on generated CSS classes.

The published archive needs independent React-consumer checks for ESM, declarations, CSS, theme inheritance, SSR, lazy
worker/Wasm assets and dependency isolation. The Mechane integration additionally uses the packaged celld and Cloudflare
application. Aggregate charts require correctly defined API data; a chart over a recent event page must not present
itself as an installation-wide total.

Useful temporary workload probes include a 1 MB source file, a 10,000-path tree, 10,000 time-series observations, and a
256 × 256 matrix. These are proposed investigation sizes, not performance claims or permanent benchmark suites. Results
should guide rendering budgets and any Canvas work before a general renderer abstraction is considered.

The package retains the existing checked-artifact and npm provenance workflow. Its existing npm trust applies to the
same package name, so this expansion adds no separate publishing identities or package-specific login process. Mechane's
installation release remains independent from the UI package version. Borrowed implementation code retains its upstream
copyright and license notices; package notices describe the actual shipped dependencies.

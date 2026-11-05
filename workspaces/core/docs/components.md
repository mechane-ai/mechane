# Elements components

Use the component catalog to choose a maintained component and copy its recommended composition. Run
`pnpm --filter @mechane-ai/elements storybook` from `workspaces/core`. Elements owns the component catalog;
`pnpm --filter @mechane/console storybook` serves application screen examples. Both use fixed synthetic data without
live application services.

**Supported** means a component belongs to the published `@mechane-ai/elements` API and has maintained behavior, types,
guidance, and synthetic catalog examples. Console adoption provides additional integration evidence; a generic library
capability does not need a Console screen to be supported. Library stories inherit the `supported` catalog tag, whose
promise is defined once in Foundations for the package release. Application-only Screens opt out. Plans do not create
callable APIs.

One npm package contains foundations, core, forms, overlays, feedback, navigation, layout, collections, content, AI, and
charts. Its manifest and named entry-point exports define the API. Colocated stories explain use; there is no parallel
component registry. Mechane compiles those same sources into its application release, independently of the Elements
version.

The [package guide](../packages/browser/elements/README.md) covers installing the npm package and its compiled CSS.

The [visual system](visual-system.md) explains the design decisions and shared geometry. Ordinary controls share one
outer height and body typography; coarse pointers use the shared target and text-entry sizes. The source tokens own
these values. Body text, captions, section headings, and record titles use their respective typography roles. Small
radii soften controls; page frames and shared dividers stay square.

## Add or change a component

1. Choose an existing family and neighboring composition. Reuse its control behavior, tokens, and named variants. Add a
   token only for a reusable visual decision that existing roles cannot express.
2. Let parents own layout. Use Row for centered controls, Stack for related groups, RecordPage for details, PageContent
   for report sections, and DataTable for comparable records. Keep explanatory copy beside the decision it informs.
3. Keep pointer hover, press, keyboard focus, pending, unavailable, and selection states distinct. Repeated navigation
   stays immediate. Use the adopted behavior library for focus and dismissal instead of writing another state machine.
4. Add useful synthetic catalog examples. Inspect long text, narrow layouts, both themes, empty and failed content, and
   the changed keyboard interaction. Compare pending and loaded geometry in the same composition.
5. Review the final source against the scoped contracts and run the package checks. Inspect the built catalog and an
   actual consuming page. Keep temporary screenshots and geometry probes outside source; retain automated tests only
   under the repository's test-curation policy.

Structural spacing uses 4, 8, 12, 16, 24, and 32px roles. The 2px token handles fine metadata separation. Border widths,
glyph dimensions, and measured optical padding are geometry, not new layout scales. Avoid section-specific margins that
duplicate a parent gap. A count and badge share a Row; a label and control share a Field.

A page title normally stands alone. Preserve descriptions supplied by records and explanations of unavailable or
restricted content. Avoid subtitles that merely narrate a page's purpose. Give every edge one border owner and every
fixed region an explicit divider; content must not scroll behind an unseparated command.

## Choose

| Need                                     | Owner and guide                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions, form fields, and choices        | [Core controls](ui-controls.md): native forms, Base UI composition, and controlled values.                                                                                       |
| Decisions, disclosure, and feedback      | [Feedback](ui-feedback.md): overlays, loading, status, and generic Trace activity.                                                                                               |
| Application shell and split panes        | [Layout stories](../packages/browser/elements/packages/layout/src/app-shell.stories.tsx) and [resizing](../packages/browser/elements/packages/layout/src/resizable.stories.tsx). |
| Comparable records, dates, and commands  | [Collections](ui-collections.md): prepared rows, stable selection, and application-owned operations.                                                                             |
| Source, changes, and recorded output     | [Content](ui-content.md): Pierre views, safe Markdown, and bounded inspection.                                                                                                   |
| Conversations and agent workflows        | [AI](ui-ai.md): prompt composition, live-edge scrolling, citations, approvals, and recipes.                                                                                      |
| Trends, distributions, and relationships | [Charts](ui-charts.md): explicit measurements, values, and linked inspection.                                                                                                    |
| Shared visual roles                      | [Token foundations](../packages/browser/elements/packages/foundations/src/tokens.stories.tsx).                                                                                   |

Each family’s metadata describes its root and public parts, their alternatives, and the decisions the application must
supply. Components accept presentation values; resource mapping, authorization, routing, and requests stay with their
application owners. Use a component’s named variant before adding placement styles.

Compound APIs such as Field and Dialog are documented through their family compositions and exported types. Inferred
Storybook prop tables are partial with the pinned compiler. Read the owning source types for inherited native and Base
UI props; the tables are not an exhaustive API reference.

Import shared tokens directly from `@mechane-ai/elements/tokens.stylex`. StyleX needs the defining export to compile
variables. These are CSS values; chart scales need numeric geometry in the caller’s unit. Shared page insets, toolbar
height, and section gaps live in the foundation's `pageGeometry`; other shell measurements belong to `elements/layout`.
Light and dark themes share the same roles. Apply `themeProps.light` or `themeProps.dark` from `/theme` to the document
root so portaled controls inherit it. Applications own theme preference and persistence.

Use CSS `calc()` when deriving CSS dimensions from imported StyleX constants. JavaScript arithmetic on a transformed
token can emit an invalid declaration even when TypeScript accepts it. Inspect the compiled value and the resulting
geometry. Likewise, conditionally applied styles must preserve their base values; verify both desktop and narrow
layouts.

Keep the compact desktop type and spacing scale. Text-entry controls use 16px text on coarse pointers, and standalone
controls provide 44px touch targets. Hover styles apply only to a fine pointer that supports hover. Shared tokens own
these decisions so applications do not repair individual controls.

Where hover and press have different colors, exclude `:active` from the hover selector. Media-conditioned hover styles
can otherwise outrank unconditional pressed styles. Verify the computed pressed state rather than only its declaration.

Keep buttons, tab selection, tooltips, and refreshes immediate. Dialogs fade and scale slightly; drawers follow their
edge and the user's swipe. Reduced motion removes transition time. Base UI owns focus, dismissal, and removal after
transitions. Use the public parts instead of adding timers or a second overlay state machine.

## Compose

Button performs an action; TextLink is an anchor. An icon-only action always needs its own accessible label, even when a
Tooltip is present. Button’s `variant` controls emphasis, `tone` describes intent, and `pending` prevents duplicate
activation. The application owns the asynchronous operation and its recovery.

Place SkipLink before application navigation. Its `href` points to the main content's stable ID. It becomes visible
immediately on focus; the destination must accept focus. The keyboard-navigation story demonstrates this composition.

Pending actions keep focus and reserve space for both labels. Unavailable actions remain disabled. Use concise labels
that describe the operation; a refresh failure belongs beside the retained content, not in a replacement empty screen.

Use `RecordPage.Root`, `Toolbar`, `Body`, `Content`, `Header`, and `Aside` to compose a resource detail. The toolbar
owns the shared top edge and optional back link; the header owns a focusable record heading. Body content and an aside
wrap naturally at narrow widths. `PageNavigation` exposes ordinary anchors with controlled current-item state.
`SettingsSection` groups settings; each `SettingsRow` binds a real control ID to its label and description. Its bounded
field column aligns ordinary controls across rows, with smaller toggles at the trailing edge. Use `PageContent` for
report sections inside their existing page frame. It owns the common inset and section gap; keep tables at their
containing frame's edge because table cells already own their insets.

Field associates its label, description, and error with the input. Native input events remain available. Choose a
controlled value with its change callback or an uncontrolled default value. A read-only value remains selectable; a
disabled control is unavailable. The [form example](../packages/browser/elements/packages/forms/src/forms.stories.tsx)
shows native validation and local draft state. Use `FormActions` for the submission row; its parent owns separation from
the preceding fields. Buttons, inputs, selects, comboboxes, and their grouped forms share the same outer control
geometry. Named variants express emphasis and intent; there is no consumer size, padding, or radius choice. Multiline
text entry retains its content height.

Multi-part controls retain Base UI names such as `Root`, `Trigger`, and `Popup`. Use `render` to compose triggers.
Shared styles apply first, then concrete native classes and style objects are merged for upstream composition. The typed
`xstyle` input accepts `PlacementStyle`, including width and placement, without replacing control height, padding,
radius, typography, focus, or disabled styles. Preserve Base UI's DOM and state transport through wrappers.

State callbacks for `className` and `style` work on a directly rendered control or the outermost trigger. The pinned
Base UI release cannot preserve those callbacks on an inner React element supplied through `render`. Use concrete
classes and style objects on that element. For state-dependent composition, use a `render` function, spread its supplied
props, and choose named variants from its state. The
[Dialog examples](../packages/browser/elements/packages/overlays/src/dialog.stories.tsx) show both patterns with a
Tooltip. Base UI documents [render functions](https://base-ui.com/react/handbook/composition#render-function) and their
[explicit prop merging](https://base-ui.com/react/utils/merge-props).

Keep a successful result mounted during refreshes. Show refresh progress or failure beside that result. Use
`AsyncRegion` for missing initial data and `EmptyState` for a successful empty result. The application decides when
access loss or a resource change requires clearing data.

`AsyncRegion` requires an explicit `state`, accessible `label`, and destination-specific `placeholder`. Pending reserves
the placeholder geometry immediately and reveals it after two seconds with a 120ms entrance. Ready content enters in
80ms; ready-at-mount and failed content appear immediately. The failed and ready states require children; pending
forbids them. Reduced motion removes the fades, and completion never waits for a minimum loading duration.

`LoadingScope identity={navigationIdentity}` shares one initial clock across a page. A new identity resets pending
presentation without keying or remounting ready children. A later transition back to pending within the same scope
starts a fresh delay. Keep `state="ready"` during refreshes that retain authorized content, and keep a failed result
visible while its retry action is pending. Ordinary callers do not configure timing.

Use `DataTablePlaceholder` with the real table's column roles, layout metadata, and row sizing, and
`DataTableTextPlaceholder` for cells with a leading icon or secondary line. Use `ButtonPlaceholder` and
`FieldPlaceholder` from `/feedback` inside the loaded form or settings layout; they share control recipes, including
coarse-pointer geometry. `ButtonPlaceholder icon` matches an icon-only action without accepting text width.
`PromptInputPlaceholder` reserves the composer frame, and `PageNavigationPlaceholder` reserves supplied navigation
labels without mounting a form or live anchors. Do not mount hidden live controls to measure a placeholder.

`SkeletonText` reserves inherited line boxes; use one line for labels or explicit `lines` for prose. Placeholders are
decorative and noninteractive. `ContentReveal` coordinates nested entry through the actual ancestor animation lifecycle.

## Data and content

Use `Table` for custom semantic table structures and `DataTable` for rows compared through shared columns. Pass already
prepared rows to DataTable. Sorting, query state, pagination, and eligibility belong to the application; virtualization
only bounds the rendered rows. A command's shortcut calls the same eligible action as its visible control. Declare each
column's `role`: `primary`, `text`, `status`, `number`, `timestamp`, or `actions`. Roles determine alignment and
readable minimum sizing; primary columns use remaining width. Numbers, timestamps, and actions align to the end. Use
explicit `width` or `truncate` only when content needs it, and share that metadata with pending rows.

Use `Trace` for ordered activity and disclosure, `Waterfall` for supplied temporal evidence, and `RelationGraph` for
explicit relationships. Charts receive prepared measurements, formatters, units, and missing-value meaning. They do not
query a backend, compute an embedding, or turn a page of records into an installation-wide total.

Use `Markdown` for supplied text and `CodeBlock` for source. Renderers preserve readable text before optional heavy code
loads. Applications redact private values before passing them in. Remote media, links, and embedded content have
explicit presentation policies; recorded output never becomes an executable terminal or web preview.

Conversation owns scroll anchoring while the application owns message identity and transport. PromptInput receives a
draft and reports submission. Approval receives an identified pending decision and reports intent. Neither component
assumes that a click or a successful request means the underlying operation has completed.

## Review

Start with each family’s first example or **Recommended** story. Other stories show supported variants and meaningful
states. Narrow examples cover layouts that change behavior, including tables, navigation, tabs, and Waterfall. Long
labels and unknown values stay part of those maintained examples.

Use Storybook’s accessibility panel, then inspect keyboard order, visible focus, labels, announcements, dismissal, and
focus return. The catalog does not import Console global styles, so components must own their appearance. Automated
accessibility results alone do not establish complete accessibility.

Use the theme toolbar to switch the entire preview between light and dark, including portaled menus and dialogs. The
viewport control reviews the same examples at narrow widths. Open disclosures and popups in both themes; a closed
trigger does not show the panel's layout. Chart data and source disclosures use the same Collapsible as activity views.

`pnpm --filter @mechane-ai/elements build-storybook` uses the application’s React and StyleX compiler settings. Stories
are developer documentation: the preview removes the inherited test tag, and no play assertion runs by default. Add a
retained interaction check only for a consequential gap under the repository’s test-curation rules. Browser acceptance
against the packaged Console remains necessary for application wiring and real requests.

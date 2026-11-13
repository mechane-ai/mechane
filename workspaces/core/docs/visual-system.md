# Elements visual system

Accepted November 5, 2026 after Nexus adoption exposed inconsistent page composition. The goal is compact, quiet
software whose controls behave predictably. Tinker inspired the visual direction. Its branding and private data are not
part of this package.

## Shared language and ownership

Tokens name reusable visual decisions. Components apply those decisions to a role. Compositions arrange components
without changing their internals. Applications supply records, permissions, navigation, and asynchronous operations. An
application correcting button padding or table typography indicates a missing shared component decision.

This follows Carbon's separation of spacing tokens from parent-owned layout and its use of type roles rather than
independent font choices.[^carbon-spacing][^carbon-type] Linear's redesign described aligning chrome, headers, and
panels while reducing noise. The useful lesson here is coherence across complete screens.[^linear-redesign]

The existing [token source](../packages/browser/elements/packages/foundations/src/tokens.stylex.ts) owns values. A 4px
structural scale expresses relationships: close metadata, related controls, form groups, and separate page sections.
Tiny glyph offsets, borders, and optical control padding have different jobs. Forcing every measurement onto that scale
would damage alignment. Text sizes follow the compact type hierarchy, not the spacing scale.

Radix's Button and Text Field share a default size, and its Text Field guide recommends matching sizes when composing
controls.[^radix-button][^radix-text-field] That supports the shared-size approach. The particular geometry here is our
choice, not a requirement from another design system.

## Geometry and alignment

The foundation's `pageGeometry`, `controls`, and `tableGeometry` own different roles. Equal values do not couple those
roles: changing a touch target does not change page padding, and a table row does not inherit toolbar behavior. Layout
and collections consume foundations independently, without sharing a page controller.

| Role                                   | Geometry and owner                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Page content edge                      | `pageGeometry.inset` is 16px. Section headings, table-cell content, and inset report frames share that edge.                    |
| Shell toolbar and navigation cell      | 48px. Separators do not subtract from the area used to centre their contents.                                                   |
| Section heading and collection toolbar | 48px minimum. A single row of ordinary controls fits that height; wrapped content grows.                                        |
| Standard single-line control           | 32px including borders; 44px for coarse pointers. This is the default shared control recipe.                                    |
| Compact report caption                 | 36px minimum; at least 48px for coarse pointers. Titles and action groups may wrap independently.                               |
| Explicit compact single-line control   | 28px including borders; 44px for coarse pointers. The same recipe owns focus, padding and pending geometry.                     |
| Navigation item                        | 32px; 44px for coarse pointers. Expanded navigation has 8px outer and item insets; collapsed items centre in the rail.          |
| Standard navigation or leading glyph   | A 16px box that does not shrink beside text. Small indicators, artwork and avatars retain their intended sizes.                 |
| Table row and column header            | 48px row; 36px header baseline, growing for larger sort targets. Table geometry owns the virtualizer's matching fixed estimate. |
| Page section gap                       | `pageGeometry.sectionGap` is 32px. The containing composition owns it.                                                          |

Use the same edge for equivalent content, rather than aligning every label on a page. Table rules reach the task-pane
edges while cells own their inset. An inset report frame starts at the content edge, then its heading, summary and
legend share an internal inset. A plot also reserves room for axis labels. Toolbar titles follow their leading
navigation control; that title does not define the body's left edge. Reading columns, dialogs and inspectors keep their
own containing width.

Page and collection header rows share one
[padding recipe](../packages/browser/elements/packages/foundations/src/header-styles.ts) around standard controls, with
8px above and below a 32px control or 2px around a 44px target. Their noninteractive separators do not add another
layout pixel. A report caption uses `reportGeometry.headerHeight` and 28px compact controls; coarse pointers expand its
header and targets. Titles and action groups may wrap; never clip content to preserve a nominal row height. Shell cells
centre their controls; text rows align by their line boxes, and adjacent text uses a common baseline. Measured glyph and
border adjustments stay with the owning component.

The expanded sidebar header owns its inset; supply branding or a selector without another outer gutter. Its collapsed
rail and phone drawer use their own supported layout. Use `NavigationSection` for group labels and `NavigationLink` or
`NavigationItem` for destinations or actions. Parent navigation owns spacing; children do not add corrective margins.

Native single-line fields, including date and month inputs, and their placeholders share outer sizing. Controls with
wrapped labels or larger leading artwork may grow, as may multiline text entry. Coarse-pointer text entry uses 16px
type. Keep native editing and picker affordances, and compare field and placeholder geometry in the same browser.
Consumers choose intent, the finite control density and placement without overriding height, padding or typography.

Choose a heading by its scope:

| Scope                                  | Heading and controls                                                                               | Boundary                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Independent page section or collection | `SectionHeading` or `CollectionToolbar`; 48px standard row and 32px standard controls.             | Owns its page inset and section separation.                                      |
| One chart report                       | The chart's private caption; 36px row and explicit 28px compact controls through `report.actions`. | Stays quiet without a gray header fill, inside the report's single subtle frame. |
| Prose or form content within a section | `Subheading`; standard form controls.                                                              | Uses the containing reading column or form inset.                                |

`ControlDensity` has only `standard` and `compact`; standard is the default. Set `density="compact"` on each supported
report control and its matching placeholder. Charts add no default data-dialog control. Select and combobox popup
contents also remain standard. A compound control scopes density to its own input, addons and buttons; an unrelated
nested control keeps its own default. Layouts never propagate density.

Keep role decisions independent. A collection inside a report may still define an independent browsing task and use its
standard heading and controls. The 16px content edge and full-width table rows remain the same at both densities.
Pending captions keep the known title, actions, density and wrapping of their ready composition.

`DataTableText` preserves the size of supplied leading artwork and its record-identity gap. Use the same size and
fallback within a collection, including its placeholder. An absent adornment contributes no slot or gap. A logo or
avatar need not share the ordinary glyph's size; reserve an empty slot only when mixed records need aligned labels.

## Composition decisions

Choose the containing task before its inset, scrolling behavior, or visual boundary.

| Need                                                               | Composition and boundary                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Related sections in ordinary page flow                             | `Stack` with section headings and shared gaps.                                                     |
| Independent section title, metadata and scoped actions             | Standard `SectionHeading` defines the section. `Subheading` names prose or form content within it. |
| Inset content inside a page                                        | `PageContent` owns one inset and the gaps between its children.                                    |
| An inset report followed by a finite breakdown                     | `ReportContent` scrolls with the page and leaves its breakdown full width.                         |
| One primary searchable or virtualized collection                   | `CollectionLayout` keeps its header above a viewport filling the available height.                 |
| One record's identity, content and properties                      | `RecordPage` supplies the toolbar, header, content and optional aside.                             |
| A centered form or reading column                                  | `DetailPage` supplies the content measure.                                                         |
| A standalone sign-in or focused step outside the application shell | `FocusPage` centers one bounded task.                                                              |
| Tool panes and an independently scrolling inspector                | `Workbench` and its scroll regions own those boundaries.                                           |
| A self-contained analytical report                                 | The chart's `report` input groups its compact caption, summary and plot in one subtle frame.       |
| A plot embedded in an existing content region                      | The chart supplies its own title, legend and inspection. The containing region owns separation.    |
| A bounded decision, linked item or structured message Card         | `Panel` provides the unit's boundary.                                                              |

Prefer vertically stacked sections for related page content. Use columns when the views need simultaneous comparison and
remain readable at their actual widths. A self-contained report owns one frame. Its surrounding page can stay flat.
Charts, tables and settings already supply their internal structure, so choose a Panel only for an additional
independent unit. Component examples show valid local contexts rather than prescribing a grid of cards for every page.

Comparable records use tables. Each column declares a role: primary identity, text, status, number, timestamp, or
actions. Primary text absorbs available width. Text and status align to the start; numbers, timestamps, and actions
align to the end. Headers and placeholders follow the same roles. Spectrum similarly distinguishes text from comparable
numbers and aligns headers with their cells.[^spectrum-table] Trailing timestamps and actions are our composition
choice. Explicit widths and truncation remain available for content that needs them.

Tables use the full width of their containing task region. Their cells own the inset. A report's chart may be inset
while its supporting rows extend to the section edges. Dialogs, inspectors and structured message Cards provide their
own containing width and scroll boundary. Read-only reference tables that explain nearby prose, such as argument
definitions, can remain in a reading column. Keep summaries outside the table's viewport and controls with their
collection.

Ordinary table rows share a 48px height and vertically centered content. Long prose belongs in the record view;
multiline operational content uses explicit content-sized rows. A timeline describes a sequence of events, rather than
replacing a searchable table.

Page chrome names the destination and exposes its actions. A subtitle that restates the title adds noise. Necessary help
belongs beside the decision it informs. Record-supplied descriptions, empty-state explanations, and access errors remain
meaningful content.

Each shared edge has one separator. Each scrolling region has one owner. A pinned footer has an opaque surface and a
visible divider, with enough height for its actual content. Adjacent navigation targets meet without dead gaps. Parent
Row and Stack compositions own spacing; individual children do not accumulate corrective margins. FormActions owns
submission rows, and SettingsRow aligns labels with one bounded field column. Applications own the content and
callbacks.

Supply scoped report actions through `report.actions`, with explicit compact density on their controls. The chart does
not add unrelated actions. Keep page commands in the page toolbar and collection commands with their independent
collection. Density does not change action ownership or hide actions needed for recovery.

Supply a chart's mixed metrics through `report.summary`. Use `report.seriesValues` when period metrics correspond to its
series. The chart reuses their labels and colors. Metric supplies inline, statistic and headline presentations, with
shared pending value and qualification geometry. The caller owns formatted aggregates, reporting scope and coverage.
Current inventory and historical activity retain separate groups because they describe different populations. A metric's
optional trend slot holds a passive graphic.

Use SmallMultiples when readers compare observations at the same timestamps. A local selector changes the analytical
question, such as total time or time per run. Independent browsing or operational tasks use separate destinations.
Related forms, finite breakdowns and selected-record details can stay together. Different populations need clear scope
within their sections. PageNavigation links destinations. ContentTabs mounts the selected content. ViewStack retains
mounted views when drafts or reading positions need to survive a switch.

Base UI owns control semantics and composition.[^base-composition] Sonner owns toast stacking, timers, and dismissal;
Elements owns its appearance.[^sonner] A missing initial result needs a local error with a way to retry. A failed
refresh keeps the last usable content and reports once. A mutation reports at its operation owner. Two renderers for one
error make the interface look less reliable and make recovery harder to understand.

Sonner's published module injects its structural CSS without a nonce. The Elements release build extracts that exact
versioned stylesheet into the package's existing CSS asset and bundles the notification runtime. This keeps the
consumer's normal stylesheet and CSP setup sufficient. The build refuses a changed injection format for review; the
archive retains Sonner's MIT notice. A production-browser check must include notifications and CSP events.

## Loading without movement

Pending content occupies its final layout immediately. The decoration stays invisible for the shared two-second delay,
then enters with a 120ms opacity fade. Ready content uses an 80ms entrance. These values live in the shared `loading`
definitions in the token source; applications do not choose their own delays. Reduced motion removes the entrances.
Errors, action results, and cached ready data appear immediately. There is no minimum loader duration.

The route supplies one loading identity. Dependent initial reads share its clock, and the application coordinates the
heading, available actions, and primary content before revealing them together. An optional read can remain pending
without holding the rest of the page. A neutral shell reserves geometry before protected records arrive. Before the
session identifies a destination, the neutral entry shows only its quiet opening message after the same delay. It does
not guess whether a sign-in screen or an authorized workspace will follow.

Placeholders reuse the loaded layout's rows, columns, headings, and control dimensions. A conversation reserves its
viewport and composer; a table uses its actual column definitions. This avoids a generic stack of bars that changes the
page shape when it disappears. Collections and AI compose feedback's skeleton primitives inside their table and composer
geometry; feedback remains independent of both families. Decorative placeholders are inert and hidden from assistive
technology; the pending region exposes its busy state and announces once after the delay.

Same-view refresh keeps mounted content, focus, scroll, and drafts. An explicit refresh marks its control pending;
routine polling stays visually quiet. Refresh failures and retry belong beside the retained content. Loading identity
resets presentation timing without remounting the page. The resource boundary owns read state, and Elements owns the
clock and reveal; screens provide a named placeholder composition. Contract 071 defines this boundary and separates
import/type enforcement from the browser checks that establish timing and geometry.

## Extending the system

A visual role has one implementation. Comparable records use `DataTable`, including small finite lists. Display choices
use `DisplayOptions`; applications provide their labels, checked state, and change operation. A collection has one
action slot. Grouping actions or preserving them during a refresh is a composition decision, not a second action API.

Keep distinctions that change behavior: a quick filter menu and a form with Apply have different commit semantics; an
inline link and a toolbar action have different layout roles. Remove choices that only reproduce an existing role.
Before adding a prop, identify the user interaction that needs it and show it in a real composition.

A new component starts by choosing its role and an existing neighboring component. A shared new visual role can justify
a token. A one-off diagram coordinate does not. Named component variants keep applications from assembling new visual
dialects through style overrides.

Visual review covers actual compositions: long labels, missing data, failure, narrow width, keyboard focus, and both
themes. An isolated default example cannot establish that a component fits a page. The
[authoring workflow](components.md#add-or-change-a-component) and contracts 066, 068, 071, 074, and 076 connect that
judgment to source review and existing checks. These decisions do not require a pixel test per component.

Sources above were read November 5, 2026. They support the design choices; they do not certify this implementation.

[^carbon-spacing]: [Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview).

[^carbon-type]: [Carbon typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview).

[^linear-redesign]: [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui).

[^sonner]: [Sonner](https://sonner.emilkowal.ski).

[^base-composition]: [Base UI composition](https://base-ui.com/react/handbook/composition).

[^radix-button]: [Radix Button](https://www.radix-ui.com/themes/docs/components/button).

[^radix-text-field]: [Radix Text Field](https://www.radix-ui.com/themes/docs/components/text-field).

[^spectrum-table]: [Spectrum table guidelines](https://spectrum.adobe.com/fragments/components/table/usage-guidelines).

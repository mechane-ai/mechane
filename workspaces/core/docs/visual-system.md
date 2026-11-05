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

Ordinary buttons, icon controls, inputs, and selection triggers share one 32px outer height, including borders. Their
shared recipe owns padding, radius, and body typography. Coarse pointers use 44px targets and 16px text entry; multiline
text entry keeps its own content height. Consumers choose intent and placement without adjusting control geometry.
Decorative control placeholders use the same recipe, so a pending form fits its loaded composition.

The foundation's `pageGeometry` defines a 16px page inset, 48px toolbar height, and 32px section gap. Layout and
collections consume it independently. The same values align a record, collection, or report without making them share a
page controller. A table owns its cell insets; wrapping it in another page gutter would double that spacing.

Radix's Button and Text Field share a default size, and its Text Field guide recommends matching sizes when composing
controls.[^radix-button][^radix-text-field] That supports the shared-size approach. The particular geometry here is our
choice, not a requirement from another design system.

## Composition decisions

Comparable records use tables. Each column declares a role: primary identity, text, status, number, timestamp, or
actions. Primary text absorbs available width. Text and status align to the start; numbers, timestamps, and actions
align to the end. Headers and placeholders follow the same roles. Spectrum similarly distinguishes text from comparable
numbers and aligns headers with their cells.[^spectrum-table] Trailing timestamps and actions are our composition
choice. Explicit widths and truncation remain available for content that needs them.

Ordinary table rows share a 48px height and vertically centered content. Long prose belongs in the record view;
multiline operational content uses explicit content-sized rows. A timeline describes a sequence of events, rather than
replacing a searchable table.

Page chrome names the destination and exposes its actions. A subtitle that restates the title adds noise. Necessary help
belongs beside the decision it informs. Record-supplied descriptions, empty-state explanations, and access errors remain
meaningful content.

Each shared edge has one separator. Each scrolling region has one owner. A pinned footer has an opaque surface and a
visible divider, with enough height for its actual content. Adjacent navigation targets meet without dead gaps. Parent
Row and Stack compositions own spacing; individual children do not accumulate corrective margins. RecordPage groups
record content, while PageContent arranges report sections inside an existing page frame. FormActions owns submission
rows, and SettingsRow aligns labels with one bounded field column. These are small compositions with application-owned
content and callbacks; they introduce no routing, query, or lifecycle protocol.

Base UI owns control semantics and composition.[^base-composition] Sonner owns toast stacking, timers, and dismissal;
Elements owns its appearance.[^sonner] A missing initial result needs a local error with a way to retry. A failed
refresh keeps the last usable content and reports once. A mutation reports at its operation owner. Two renderers for one
error make the interface look less reliable and make recovery harder to understand.

Sonner's published module injects its structural CSS without a nonce. The Elements release build extracts that exact
versioned stylesheet into the package's existing CSS asset and bundles the notification runtime. This keeps the
consumer's normal stylesheet and CSP setup sufficient. The build refuses a changed injection format for review; the
archive retains Sonner's MIT notice. A production-browser check must include notifications and CSP events.

## Extending the system

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

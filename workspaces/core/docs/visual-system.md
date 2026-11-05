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

## Composition decisions

Comparable records use tables. Each row has the same column alignment and default height; long prose belongs in the
record view. Multiline operational content is an explicit row-sizing choice. A timeline describes a sequence of events,
not a replacement for a searchable table.

Page chrome names the destination and exposes its actions. A subtitle that restates the title adds noise. Necessary help
belongs beside the decision it informs. Record-supplied descriptions, empty-state explanations, and access errors remain
meaningful content.

Each shared edge has one separator. Each scrolling region has one owner. A pinned footer has an opaque surface and a
visible divider, with enough height for its actual content. Adjacent navigation targets meet without dead gaps. Parent
Row and Stack compositions own spacing; individual children do not accumulate corrective margins.

Base UI owns control semantics and composition.[^base-composition] Sonner owns toast stacking, timers, and dismissal;
Elements owns its appearance.[^sonner] A missing initial result needs a local error with a way to retry. A failed
refresh keeps the last usable content and reports once. A mutation reports at its operation owner. Two renderers for one
error make the interface look less reliable and make recovery harder to understand.

Sonner's published module injects its structural CSS without a nonce. The Elements release build extracts that exact
versioned stylesheet into the package's existing CSS asset and bundles the notification runtime. This keeps the
consumer's normal stylesheet and CSP setup sufficient. The build refuses a changed injection format for review; the
archive retains Sonner's MIT notice. A production-browser check must include notifications and CSP events.

## Extending the system

A new component starts by choosing its role and an existing neighboring component. A genuinely shared new visual role
can justify a token. A one-off diagram coordinate does not. Named component variants keep applications from assembling
new visual dialects through style overrides.

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

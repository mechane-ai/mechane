---
name: ui-design-tokens
paths: ["packages/browser/**/src/**/*.ts","packages/browser/**/src/**/*.tsx","packages/browser/**/src/**/*.css"]
message: Name shared visual decisions as semantic tokens and expose named variants, not unrestricted style overrides.
requires-tenet: 0.11.0
---

## Rules

Define shared color, typography, spacing, radius, elevation, layer, control-size, breakpoint, and motion-timing decisions as semantic tokens in one token source.
Name tokens for their role, such as surface, danger, or control height, not for their raw value.
Keep literal palette values in the token source, and do not define feature-local themes.
Give each foreground color token at least the declared contrast ratio against every surface token it is used on, in every supported theme.
Reference tokens for shadows, stacking order, transition and animation timing, and interactive target sizes.
Use named breakpoint and user-preference conditions instead of repeating raw screen-size or preference checks.
Add a token when more than one component shares a new visual decision.
Do not extend a feature-specific accent to unrelated controls.
Keep structural literals local when they describe content geometry or rendering mechanics, such as grid tracks, percentages, border widths, focus offsets, and glyph or chart geometry.

Expose supported visual choices as named variants, such as size, tone, density, and padding.
Where styles are defined as an object keyed by name, select a variant's style by indexing one definition keyed by the variant's members, such as `toneStyles[tone]`.
Never pick such a style by comparing the variant with a member, such as `tone === Tone.Positive && styles.positive`.
Give every member a key in that definition, with an empty style for a member that adds nothing.
Give that definition a type argument keyed by the variant's set, such as `Record<Tone, Style>`, so the type checker rejects a missing member and a key outside the set.
Do not accept unrestricted style overrides, such as arbitrary style classes or style values, on public components.
Accept placement of a component's root only through a constrained layout input.
Style application composition through the application's own wrappers rather than by overriding shared components.
Do not restyle a shared component's internal parts or its focus, dialog, or disabled states from application styles.
Keep one styling system per component, and never define the same element's properties in two systems.

Keep global styles in application shells, and do not make components depend on a shell's global styles for their appearance.

Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.
Suppress a finding only as `code-lint-suppressions` allows.

Violation: a badge passes `tone === Tone.Positive && styles.positive` and `tone === Tone.Warning && styles.warning` to its style call.
Allowed: a badge passes `toneStyles[tone]` from one style definition whose type argument is `Record<Tone, Style>`, keyed `neutral`, `positive`, and `warning`, where `neutral` holds an empty style.

## Checks

Review each new literal in changed styles: is it structural geometry, or a reusable color, spacing, typography, elevation, layer, or motion decision?
Search changed public component inputs for unrestricted class, style, or style-object parameters.
Render changed components in an isolated catalog without application styles, and compare them with the visual reference.
Check the contrast of changed color tokens against the surfaces that use them in every supported theme.
Run the repository's existing style lint for literals and repeated conditions where it exists, and review the rest by hand.
Run the repository's lint from the repository root and confirm that it reports a variant compared with a member inside a style call.

## Local adaptations

Shared variable roles live in `packages/browser/elements/packages/foundations/src/tokens.stylex.ts`.
Literal conditions and constants live beside them in `constants.stylex.ts`; both are defining StyleX modules.
The foundation's `pageGeometry` owns page insets, toolbar height, and section gaps for layout and collections.
Keep those families independent; neither imports the other to obtain shared geometry. Other shell measurements belong to `elements/layout`.
The supported themes are light and dark. Apply the chosen theme to the document root so portaled content inherits it.
Text uses the declared `textContrast` and `largeTextContrast` ratios against its actual
surface, with WCAG 2.2 AA's exceptions for inactive controls and decorative text.

Single-line controls expose one finite `ControlDensity`: `standard` by default and explicitly selected `compact`.
The shared `controlStyles` recipe uses `controls.height` for standard controls and `controls.compactHeight` for compact
controls, including borders. Both use `controls.coarseTarget` for coarse pointers. Body typography and text-entry
`typography.touchInputSize` remain shared. Native date and month fields follow the same density recipe.
Keep multiline entry content-sized. Let wrapped labels or larger leading artwork grow instead of clipping them.
Expose emphasis, intent and density through named variants, without arbitrary control size, padding or radius choices.
`ButtonPlaceholder` and single-line `FieldPlaceholder` accept the same density as their loaded control.
Pending and loaded compositions keep matching geometry.

Choose compact controls explicitly for a compact chart caption or another documented dense composition.
Keep page toolbars, independent section and collection controls, forms, popup options and dialog contents standard by
default. A compact compound control scopes density to its own parts; it does not shrink unrelated nested controls.
Do not inherit density from a page, report or layout container. Preserve independent roles when a standard collection
appears inside a compact report composition.
Use the same intrinsic content row for ordinary and reserved button labels. Keep icons at their supplied size while
text wraps; inline SVG baseline space can turn a 32px control into 33px, and flex shrink can compress a 16px glyph.
Reserve visible pending text only. Icon-only actions use `IconButton` and keep their accessible name and busy state
without reserving hidden text width.

The upstream clause "Do not accept unrestricted style overrides, such as arbitrary style classes or style values,
on public components." is replaced by this composition boundary: expose named variants and `PlacementStyle` for root
placement, while preserving Base UI's `className`, `style`, `render`, refs, events, and state transport.
Application code must not use that transport to change control height, padding, radius, typography, internal parts,
focus, or disabled states. Upstream positioning and state styles remain part of composition.
Preserve Sonner's notification API for content and behavior; Elements' Toaster owns appearance.
Contract 114 owns composition-prop preservation and production compiler checks.

The registry loads both shipped `variant-style-comparisons` rules from `assets/ast-grep/rules` in place.
Their examples distinguish a named variant from a comparison between two runtime record identifiers.
Exhaustive maps remain a TypeScript requirement; the syntax rule alone does not prove exhaustiveness.

The visual-token rules run separately over TypeScript and TSX. In browser StyleX creation calls and TSX inline styles,
they reject raw colors, font sizes and weights, nonzero gaps, padding and margins, radii, shadows, and transition values.
Keep token definitions outside component style creation. Zero resets and reduced-motion timing remain valid.
The canonical clipped, one-pixel, absolutely positioned accessibility recipe retains its negative one-pixel margin.
The TypeScript visual-token matcher and TSX control-geometry matcher each own their generated parser companion.
The language-specific style-scope utilities distinguish StyleX calls from JSX inline attributes.

The control-geometry rules reject raw height and block-size values in named ordinary control recipes in actions,
forms, shared control styles, and placeholders. Chart coordinates, measured widths, viewport sizing, glyphs,
pseudo-elements, and content-sized textareas retain their geometry. Express related measured dimensions once;
for example, derive a switch thumb's travel from its track and thumb dimensions. Review opaque expressions and styles
outside these syntax patterns against the same ownership boundary.

The Console and ConsoleViews control-override rule resolves named Elements imports and aliases. It rejects explicit
`className`, `style`, and `stylex.props` spreads on the listed controls and control parts. Use supported variants and
typed `xstyle` placement. Base UI's injected prop spreads, rendered native elements, and Positioner styles remain valid.
This rule does not resolve arbitrary stylesheet references or prove that a prop spread contains only composition data.

Use one tab geometry for route links and local panels. `PageNavigation` and `Tabs` share the navigation family's
`tab-styles.ts`; their semantics differ, not their typography, inset, height or selected indicator. Put adjacent
view controls in `PageNavigation.actions`, outside the scrolling links. Do not nest page navigation in a padded
collection toolbar. Embedded navigation belongs only inside a containing toolbar that already owns its separator.

Compose page headers with `PageToolbar` and `ToolbarAction`, including navigation links and copy behavior through
`render`. Use `RecordPage` for record bodies and `PageContent` for report sections inside an existing page frame.
These components own page insets and section gaps. Use `FormActions` for form submission rows and `SettingsRow` for
settings labels and their shared field column. The containing form owns separation above its actions.
Do not repair these compositions with local gutters or action margins.

Assign each edge one separator and each gutter one layout owner. A table owns its cell insets; its page does not add
a second inset around rows. A reading column may constrain prose without constraining the toolbar or table.
Use supported layout modes rather than negative margins or application selectors targeting component internals.
Parent `Row` and `Stack` own alignment and gaps. Structural gaps use the shared 4px scale; borders and measured optical
alignment have separate geometry. Detail titles and prose wrap without widening their container.

Use the shared header-row recipe for `SectionHeading` and `CollectionToolbar`. A standard single-line row fits
`pageGeometry.toolbarHeight`, including its separator; wrapping may grow it. Shell toolbar and navigation-cell rules
do not consume the area used to centre their contents. Keep `pageGeometry`, `controls`, and `tableGeometry` independent
by role, even where values match. The public `docs/visual-system.md#geometry-and-alignment` defines their relationships.

Keep chart captions separate from page-level `SectionHeading`. A private chart heading uses the compact
`reportGeometry.headerHeight` with explicitly compact actions; coarse pointers retain at least the standard header
height. Keep its surface quiet, without a gray header fill. The chart report retains its one subtle outer frame.
Page and collection headings remain standard even beside a compact chart caption.

Give the expanded sidebar header its inset at the slot, rather than in supplied branding or selectors. Use
`NavigationSection` for group-label geometry. Keep collapsed rails and phone drawers within their supported layout;
an expanded header's padding must not squeeze a collapsed control. Ordinary navigation uses the shared control height.
Expanded navigation uses 8px outer and item insets; collapsed items centre in the rail. Logos and avatars retain their
content geometry instead of inheriting an icon size.

Keep navigation hit areas contiguous within a group. Scrolling commands belong in the navigation region. Reserve
fixed footer regions for persistent content with an explicit separator and opaque surface; never float a command over
the last scrolling item. Inspect the last navigation item and footer with a short viewport as well as the first screen.

Responsive groups follow their container width. Metric columns use `MetricGrid layout="columns"`.
Settings sections constrain grid tracks so wide tables scroll inside their region without expanding the page.
Multiple toolbar actions supply concise labels and icons so compact toolbars preserve navigation and accessible actions.
Keep toolbar action groups at their intrinsic width while the title shrinks and truncates within the remaining space.
Ordinary embedded charts leave their visual boundary with the containing region.
Use a chart's report composition for a self-contained report with one subtle frame.
Let one component own each boundary. Chart titles and action groups wrap independently.

Choose typography and weight by role: body for records and ordinary controls, caption for metadata and chart inspection
hints, section for grouped content, and heading for record identity. Pending compositions use the same semantic tokens.
When base, variant, and responsive styles set the same property, preserve each intended condition in the final
composition. A conditional width must not erase the base width or make loaded and pending content disagree.

Page titles stand alone by default. Keep record-supplied descriptions and explanations needed to make a decision, but
omit generic subtitles that restate the destination. Put field help beside its field. Comparable records use shared
table geometry; event prose uses a timeline or detail view rather than an uneven grid of record cards.
Keep the page title readable when controls crowd a narrow toolbar. Wrap its actions into another row before shrinking
the title away or overflowing the page; preserve the ordinary toolbar height when everything fits.

Review mixed controls and their placeholders at fine and coarse pointer sizes: do their outer boxes and text align,
including when a trigger composes a button? Review a collection, record, report, and settings form at desktop and narrow
widths for shared gutters, section rhythm, field alignment, and a single separator at each boundary.
Compare native date and month fields with placeholders, and a header with its pending and wrapped forms. Check the
complete cell used for centring, not only its declared height. Inspect expanded, collapsed and drawer navigation after
switching between them; preserve readable content, visible focus and usable targets with enlarged text.
Compare explicit compact controls with standard neighbors, popup contents and dialogs. Does a wrapped or coarse-pointer
caption grow without changing the density of an independent collection or clipping its title, actions or focus ring?
Open a disclosure and inspect a chart value. Check computed responsive widths and the last navigation item in a short
viewport; a passing style or type check does not establish these visual properties.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `textContrast` 4.5; `largeTextContrast` 3.
- ast-grep `ui-visual-token-values` (066): enforced
- ast-grep `ui-visual-token-values-typescript` (066): enforced
- ast-grep `ui-control-geometry` (066): enforced
- ast-grep `ui-control-geometry-typescript` (066): enforced
- ast-grep `ui-control-style-overrides` (066): enforced
- asset `assets/ast-grep/rules` `variant-style-comparisons-typescript` (066): enforced
- asset `assets/ast-grep/rules` `variant-style-comparisons-tsx` (066): enforced

<!-- End of the generated block. -->

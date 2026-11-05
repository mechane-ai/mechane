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

Shared visual roles live in `packages/browser/elements/packages/foundations/src/tokens.stylex.ts`.
The foundation's `pageGeometry` owns page insets, toolbar height, and section gaps for layout and collections.
Keep those families independent; neither imports the other to obtain shared geometry. Other shell measurements belong to `elements/layout`.
The supported themes are light and dark. Apply the chosen theme to the document root so portaled content inherits it.
Text uses the declared `textContrast` and `largeTextContrast` ratios against its actual
surface, with WCAG 2.2 AA's exceptions for inactive controls and decorative text.

Ordinary buttons, icon controls, inputs, selection triggers, and input groups share `controls.height` as their outer
height, including borders. Use the shared `controlStyles` recipe and body typography; coarse pointers use
`controls.coarseTarget` and text entry uses `typography.touchInputSize`. Keep multiline text entry content-sized.
Expose emphasis and intent through named variants, without public control size, padding, or radius choices.
`ButtonPlaceholder` and `FieldPlaceholder` reuse that recipe; pending and loaded controls have the same geometry.

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

The UI package rejects literal color, font-size, font-weight, nonzero gap, shadow, and nonzero transition timing values in component styles.
Define those roles in `tokens.stylex.ts`; zero-duration motion remains available for reduced motion and direct dragging.
Review other visual literals and external theme overrides against the same ownership boundary.

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

Keep navigation hit areas contiguous within a group. Scrolling commands belong in the navigation region. Reserve
fixed footer regions for persistent content with an explicit separator and opaque surface; never float a command over
the last scrolling item. Inspect the last navigation item and footer with a short viewport as well as the first screen.

Responsive groups follow their container width. Metric columns use `MetricGrid layout="columns"`.
Settings sections constrain grid tracks so wide tables scroll inside their region without expanding the page.
Multiple toolbar actions supply concise labels and icons so compact toolbars preserve navigation and accessible actions.
Keep chart frames unboxed; a caller may group them in a Panel. Chart titles and action groups wrap independently.

Choose typography and weight by role: body for records and ordinary controls, caption for metadata and chart inspection
hints, section for grouped content, and heading for record identity. Pending compositions use the same semantic tokens.
When base, variant, and responsive styles set the same property, preserve each intended condition in the final
composition. A conditional width must not erase the base width or make loaded and pending content disagree.

Page titles stand alone by default. Keep record-supplied descriptions and explanations needed to make a decision, but
omit generic subtitles that restate the destination. Put field help beside its field. Comparable records use shared
table geometry; event prose uses a timeline or detail view rather than an uneven grid of record cards.

Review mixed controls and their placeholders at fine and coarse pointer sizes: do their outer boxes and text align,
including when a trigger composes a button? Review a collection, record, report, and settings form at desktop and narrow
widths for shared gutters, section rhythm, field alignment, and a single separator at each boundary.
Open a disclosure and inspect a chart value. Check computed responsive widths and the last navigation item in a short
viewport; a passing style or type check does not establish these visual properties.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `textContrast` 4.5; `largeTextContrast` 3.
- ast-grep `ui-visual-token-values` (066): enforced
- asset `assets/ast-grep/rules` `variant-style-comparisons-typescript` (066): enforced
- asset `assets/ast-grep/rules` `variant-style-comparisons-tsx` (066): enforced

<!-- End of the generated block. -->

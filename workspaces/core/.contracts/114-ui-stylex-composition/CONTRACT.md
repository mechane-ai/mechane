---
name: ui-stylex-composition
message: Preserve control composition and token imports through the production StyleX compiler.
paths: ["packages/browser/elements/**","packages/browser/catalog/src/stylex-*.ts","packages/browser/console/vite.config.ts","packages/browser/console/.storybook/**"]
---

## Rules

Import tokens through their declared `.stylex` definition export, which resolves directly to the defining source file.
Configure the application and Storybook compilers to resolve that package path. Keep StyleX variable references out of
numeric chart geometry.

Preserve composed refs, accessible attributes, event callbacks, classes, and inline styles when wrapping Base UI.
Merge the component's StyleX output with incoming composition props using Base UI's composition helpers or an equivalent
documented policy. Keep the component's visual states authoritative while preserving injected positioning and callbacks.
Use the same path when a control is rendered directly or supplied through another control's `render` prop.

Use supported StyleX longhands for borders, outlines, backgrounds, and fonts. Confirm those styles survive the production
compiler. The existing `stylex-longhands` rule belongs to this contract.
Keep named variants and constrained root placement within contract 066's visual boundary. A placement override cannot
change typography, focus, or disabled states.

Violation: a wrapper spreads incoming props and then overwrites their `className` and `style` with its own StyleX output.
Allowed: a wrapper merges those inputs with its own styles and preserves the ref and callbacks supplied by a trigger.

## Checks

Build the application and Storybook with their pinned compiler, and inspect a token import from each generic package.
Compose a styled Button with Tooltip and Dialog triggers in the built browser output. Verify accessible names, keyboard
activation, focus return, positioning, and the presence of both injected and component styles.
Inspect the isolated catalog for usable component typography, focus, and visual states without application global styles.
Run the existing `stylex-longhands` lint rule and its allowed/violation examples.

## Local adaptations

The token definition export is `@mechane-ai/elements/tokens.stylex`.
Compiler resolution and the package export map describe the same source. Normal package exports remain named exports;
the direct token definition path is the compiler-required exception.
Composition review is development evidence. It does not require a new browser suite or automatic Storybook play tests.

Published components and consumer StyleX rules share the compiler's top-level priority layers after `reset`. Do not
nest the package's rules in a separate layer: identical consumer base declarations must not outrank packaged hover,
focus, disabled, or responsive states. Put packaged token defaults and themes in `priority1`, including conditional
rules, so an independently compiled theme can override them. Preserve existing layers and non-token rules when
normalizing compiler output. Consumer themes can override token defaults. Preserve the defining token's
package-relative path so separately compiled themes target the same variables. Verify both an ordinary React consumer
and a StyleX consumer with overlapping base declarations, including navigation hover and portaled overlays.
Verify default, dark, and separately compiled custom themes against the packed stylesheet. Check nested conditional
tokens and an ordinary unlayered application override of a packaged theme. A component's base or hover declarations
retain their layers. Check consumer builds with and without priority-zero rules; consumer-owned themes follow their
emitted layers and selector specificity.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `stylex-longhands` (114): enforced

<!-- End of the generated block. -->

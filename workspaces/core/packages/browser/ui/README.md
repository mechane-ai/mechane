# Mechane UI

React controls, content viewers, agent interfaces, layouts, and charts with a shared compact design. Mechane's Console
consumes this same package. Components receive values and callbacks; applications own routing, data, and identity.

## Install

Install the package and its React peers:

```sh
pnpm add @mechane-ai/ui react react-dom
```

Load the stylesheet once in your application, then import components:

```tsx
import '@mechane-ai/ui/styles.css';
import { Button, Dialog } from '@mechane-ai/ui';

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

The package supplies compiled ESM, TypeScript declarations, and CSS. Ordinary React consumers need no StyleX compiler.
Applications install their own reset and fonts. Put reset rules in the `reset` CSS layer; the package's `mechane` layer
comes after it. Application styles and StyleX themes can override the package layer. The default theme is light, with
system fonts and a compact spacing scale. Apply `themeProps.light` or `themeProps.dark` from the root entry to the
document root to choose a theme for both content and portaled controls. Applications own the preference.

## Entry points

| Import                               | Responsibility                                                       |
| ------------------------------------ | -------------------------------------------------------------------- |
| `@mechane-ai/ui`                     | Controls, forms, text, feedback, generic Trace, and theme props.     |
| `@mechane-ai/ui/layout`              | Application shell, navigation, toolbars, details, and split panes.   |
| `@mechane-ai/ui/collections`         | Tables, inspectors, collection controls, dates, and scoped commands. |
| `@mechane-ai/ui/content`             | Markdown, JSON, recorded logs, and stack traces.                     |
| `@mechane-ai/ui/content/link`        | Safe content links without loading the Markdown renderer.            |
| `@mechane-ai/ui/content/code`        | CodeBlock with source-preserving highlighting.                       |
| `@mechane-ai/ui/content/diff`        | DiffViewer for file changes and patches.                             |
| `@mechane-ai/ui/content/tree`        | FileTree for paths, status, and controlled selection.                |
| `@mechane-ai/ui/ai`                  | Conversations, messages, prompts, approvals, sources, and citations. |
| `@mechane-ai/ui/charts`              | Shared chart parts and all chart families, including Waterfall.      |
| `@mechane-ai/ui/charts/cartesian`    | Time series, categorical bars, breakdowns, and treemaps.             |
| `@mechane-ai/ui/charts/distribution` | Histograms, cumulative distributions, intervals, and ranked values.  |
| `@mechane-ai/ui/charts/matrix`       | Matrices, exact token highlights, and scatter plots.                 |
| `@mechane-ai/ui/charts/graph`        | Read-only supplied relationships and node selection.                 |
| `@mechane-ai/ui/tokens`              | Compiled token references for runtime styles.                        |
| `@mechane-ai/ui/tokens.stylex`       | Direct definitions for StyleX authoring and themes.                  |
| `@mechane-ai/ui/styles.css`          | Component styles and token defaults.                                 |

These are modules of one package, with one version and stylesheet. Focused imports keep heavier families out of the core
entry. Content renderers initialize when used; applications do not configure a renderer worker pool or fetch syntax
grammars from a CDN. See the
[content guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-content.md) for renderer assets
and fallback behavior.

When upgrading from 0.2, move `Table`, `Cell`, `Details`, `Inspector`, and `ListFooter` imports to `/collections`. The
layout, Waterfall, and token entry points retain their existing paths.

Use `render` for Base UI composition and named variants for appearance. Native attributes, events, and refs remain
available. Typed `xstyle` inputs allow placement styles compiled by the consuming application's StyleX setup.
Applications own asynchronous work and pass its pending, success, or failure state to their controls.

StyleX authoring imports tokens through `@mechane-ai/ui/tokens.stylex` and enables CommonJS module resolution in the
StyleX plugin. That export retains the original defining path so the compiler's variable names match the library's CSS.
Use `stylex.createTheme` to override visual roles. Apply an application theme to the document root so portaled controls
inherit it. The ordinary `/tokens` export works in runtime style values, not in StyleX's compile-time calls.

## Develop

From `workspaces/core`, run `pnpm --filter @mechane-ai/ui build` to compile the standalone library. The workspace's
source exports let Mechane and Storybook compile the canonical components with their own production build. Package
publication selects the compiled exports declared in `publishConfig`.

Run `pnpm --filter @mechane/console storybook` for the component catalog. The
[component guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/components.md) explains family
selection, composition, supported states, and browser review. Stories use synthetic inputs. The repository's existing
checks cover source and package boundaries; installation releases and UI releases have independent versions.

The public repository publishes npm packages when an immutable `ui-vVERSION` GitHub release is published. The release
workflow rebuilds the reviewed archive and checks its digest before publishing with npm trusted publishing and
provenance. Maintainers authorize this workflow once; routine releases need no interactive npm login or stored token.

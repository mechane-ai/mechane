# Elements by Mechane

React components for applications, AI interfaces, and analytical graphics. Elements combines compact typography, square
surfaces, shared visual tokens, and accessible interactions. Mechane's Console consumes the same package. Components
receive values and callbacks; applications own routing, data, identity, and persistence.

## Install

Install [Elements from npm](https://www.npmjs.com/package/@mechane-ai/elements). React and React DOM are peer
dependencies. TypeScript consumers also supply the optional `@types/react` peer so declarations resolve in isolated
builds without relying on hoisted development dependencies.

```sh
pnpm add @mechane-ai/elements react react-dom
```

Load the stylesheet once, then import the families you use:

```tsx
import '@mechane-ai/elements/styles.css';
import { Button } from '@mechane-ai/elements';
import { Dialog } from '@mechane-ai/elements/overlays';

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

Elements supplies compiled ESM, TypeScript declarations, and CSS. Ordinary React consumers need no StyleX compiler.
Applications install their own reset and fonts. Put reset rules in the `reset` CSS layer. Elements and consumer StyleX
rules share the compiler's ordered `priority` layers. Keep those layers at the top level: wrapping Elements in another
layer lets consumer base declarations override component hover and focus states. Unlayered application themes can
override token defaults.

## Imports

Every path below belongs to `@mechane-ai/elements`. There is one package, version, and stylesheet.

| Entry                  | Responsibility                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- |
| Root                   | Buttons, text, surfaces, disclosure, Avatar, and CopyValue.                       |
| `/forms`               | Fields, inputs, selection, file picking, and settings sections.                   |
| `/forms/dates`         | Civil-date calendars and range selection.                                         |
| `/overlays`            | Dialog, Drawer, Menu, Popover, Preview, Tooltip, and AlertDialog.                 |
| `/feedback`            | Async regions, skeletons, progress, meters, notices, empty states, and toasts.    |
| `/navigation`          | Tabs, page navigation, breadcrumbs, skip links, and shortcut labels.              |
| `/navigation/commands` | Command palette and scoped application-owned shortcuts.                           |
| `/layout`              | Application shell, sidebar, toolbars, compound record pages, and resizable panes. |
| `/collections`         | Tables, inspectors, collection controls, metrics, and timestamps.                 |
| `/content`             | Trace, JSON, recorded logs, and stack traces.                                     |
| `/content/link`        | Safe content links without a renderer dependency.                                 |
| `/content/markdown`    | Completed and streaming Markdown, embedded headings, and inert previews.          |
| `/content/code`        | Source-preserving code highlighting.                                              |
| `/content/diff`        | File changes and patches.                                                         |
| `/content/tree`        | File paths, statuses, and controlled selection.                                   |
| `/ai`                  | Conversations, messages, prompts, approvals, sources, and citations.              |
| `/charts`              | Shared frames, legends, selection, and category types.                            |
| `/charts/cartesian`    | Lines, areas, sparklines, small multiples, bars, and scatter plots.               |
| `/charts/distribution` | Histograms, cumulative distributions, intervals, and ranked values.               |
| `/charts/matrix`       | Matrices, token heatmaps, and color legends.                                      |
| `/charts/graph`        | Supplied relationships and node selection.                                        |
| `/charts/hierarchy`    | Treemaps.                                                                         |
| `/charts/timeline`     | Waterfall intervals and instants.                                                 |
| `/theme`               | Light and dark theme props.                                                       |
| `/csp`                 | Application-supplied content security policy configuration.                       |
| `/tokens`              | Compiled token references for runtime styles.                                     |
| `/tokens.stylex`       | Direct definitions for StyleX authoring and themes.                               |
| `/styles.css`          | Component styles and token defaults.                                              |

Focused entries keep renderer and chart dependencies out of basic controls. There is no all-components barrel. Renderers
initialize when used, without a consumer-managed worker pool or grammar CDN. The
[content guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/ui-content.md) explains assets,
input limits, and readable fallbacks.

## Composition and themes

Use Base UI's `render` composition and named variants for appearance. Native attributes, events, and refs remain
available. Typed `xstyle` inputs permit placement styles compiled by the application's StyleX setup. Applications own
asynchronous work and pass its pending, success, or failure state to controls.

The default theme is light, with system fonts and a compact spacing scale. Import `themeProps` from
`@mechane-ai/elements/theme` and spread `themeProps.light` or `themeProps.dark` onto the document root. Portaled content
then inherits the same theme. The application owns the preference; no theme provider is required.

For custom StyleX themes, import definitions from `@mechane-ai/elements/tokens.stylex`, enable CommonJS module
resolution in the StyleX plugin, and use `stylex.createTheme`. The defining path is preserved in the archive so
generated variables match its compiled CSS. The ordinary `/tokens` entry supplies runtime references rather than
compile-time definitions.

Set the consumer compiler's `debug: false` so placement overrides use the archive's property keys. Keep definition
resolution for compilation; bundle `/tokens` runtime references to avoid reinjecting defaults over a chosen theme.

When an application's Content Security Policy requires nonces, wrap its component tree in `CSPProvider` from
`@mechane-ai/elements/csp` and pass the same request nonce used in its policy. Preserve that nonce during hydration.
This is [Base UI's CSP provider](https://base-ui.com/react/utils/csp-provider); it authorizes component style tags such
as Select's scrollbar rules. The application owns nonce generation and its security policy.

## Develop and release

From `workspaces/core`:

```sh
pnpm --filter @mechane-ai/elements storybook
pnpm --filter @mechane-ai/elements build
pnpm --filter @mechane-ai/elements build-storybook
```

The component catalog belongs to Elements. Console keeps its application screen examples separately. Both compile the
same source components and use synthetic inputs. The
[component guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/components.md) explains
composition, supported states, and browser review. Stories are documentation; they do not create an automatic assertion
suite.

Internal families live in `packages/` and share one manifest. Its explicit exports drive the build and compiled
publication paths. Contracts check family dependencies, public entries, token ownership, and renderer confinement.
Private helpers remain private. Mechane installation releases and Elements releases have independent versions.

The public repository publishes immutable `elements-vVERSION` releases through `publish-elements.yml`. The workflow
rebuilds the reviewed archive, checks its digest, and uses npm trusted publishing with provenance. Package owners
establish that trust once; routine releases need no interactive login or stored npm token.

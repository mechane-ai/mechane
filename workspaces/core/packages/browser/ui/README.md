# Mechane UI

React components, visual tokens, application layouts, and charts built with Base UI, StyleX, and visx. Mechane's Console
consumes this same package. Components receive values and callbacks; applications own routing, data, and identity.

## Install

Install the immutable package archive and its React peers:

```sh
pnpm add https://github.com/mechane-ai/mechane/releases/download/ui-v0.1.0/mechane-ui-0.1.0.tgz react react-dom
```

Load the stylesheet once in your application, then import components:

```tsx
import '@mechane/ui/styles.css';
import { Button, Dialog } from '@mechane/ui';

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

The archive supplies compiled ESM, TypeScript declarations, and CSS. Ordinary React consumers need no StyleX compiler.
Applications install their own reset and fonts. Put reset rules in the `reset` CSS layer; the package's `mechane` layer
comes after it. Application styles and StyleX themes can override the package layer. The default theme is light, with
system fonts and a compact spacing scale.

## Entry points

| Import                      | Responsibility                                           |
| --------------------------- | -------------------------------------------------------- |
| `@mechane/ui`               | Accessible controls, forms, text, tables, and feedback   |
| `@mechane/ui/layout`        | AppShell, navigation, PageToolbar, and DetailPage        |
| `@mechane/ui/charts`        | Generic Waterfall and its input type                     |
| `@mechane/ui/tokens`        | Compiled visual token references for runtime styles      |
| `@mechane/ui/tokens.stylex` | Direct token definitions for StyleX authoring and themes |
| `@mechane/ui/styles.css`    | Component styles and token defaults                      |

Use `render` for Base UI composition and named variants for appearance. Native attributes, events, and refs remain
available. Typed `xstyle` inputs allow placement styles compiled by the consuming application's StyleX setup.
Applications own asynchronous work and pass its pending, success, or failure state to their controls.

StyleX authoring imports tokens through `@mechane/ui/tokens.stylex` and enables CommonJS module resolution in the StyleX
plugin. That export retains the original defining path so the compiler's variable names match the library's CSS. Use
`stylex.createTheme` to override visual roles. Apply an application theme to the document root so portaled controls
inherit it. The ordinary `/tokens` export works in runtime style values, not in StyleX's compile-time calls.

## Develop

From `workspaces/core`, run `pnpm --filter @mechane/ui build` to compile the standalone library. The workspace's source
exports let Mechane and Storybook compile the canonical components with their own production build. Package publication
selects the compiled exports declared in `publishConfig`.

Run `pnpm --filter @mechane/console storybook` for the component catalog. The
[component guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/components.md) explains
composition, supported states, and browser review. Stories use synthetic inputs. The repository's existing checks cover
source and package boundaries; installation releases and UI releases have independent versions.

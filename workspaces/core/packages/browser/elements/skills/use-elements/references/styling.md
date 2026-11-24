# Themes, tokens and styles

## The default setup

Import `@mechane-ai/elements/styles.css` once. The package ships compiled ESM, declarations and CSS, so an ordinary
React app needs no StyleX compiler. The light theme works with no class. The application installs its own reset and
fonts.

```tsx
import { themeProps } from '@mechane-ai/elements/theme';
import type { ReactNode } from 'react';

export function Document({ isDark, children }: { readonly isDark: boolean; readonly children: ReactNode }) {
  return <html {...(isDark ? themeProps.dark : themeProps.light)}>{children}</html>;
}
```

Apply the theme to the document root so portaled menus, dialogs and tooltips inherit it. The application stores the
preference; there is no theme provider. A themed wrapper suits an isolated preview only.

`themeProps.dark` is a `className` and a `style`. Spread with your own styles, the later `className` wins and the theme
is lost without an error: `{...themeProps.dark} {...stylex.props(styles.root)}` leaves the page half dark. Put the theme
on an element of its own, or join both class names and styles:

```tsx
import { themeProps } from '@mechane-ai/elements/theme';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({ root: { minHeight: '100dvh' } });

export function ThemedRoot({ isDark, children }: { readonly isDark: boolean; readonly children: ReactNode }) {
  const theme = themeProps[isDark ? 'dark' : 'light'];
  const own = stylex.props(styles.root);

  return (
    <div className={`${theme.className ?? ''} ${own.className ?? ''}`} style={{ ...theme.style, ...own.style }}>
      {children}
    </div>
  );
}
```

## Appearance comes from the components

- Choose a named `variant`, `tone` or `density`. There is no size, padding or radius prop.
- `xstyle`, where a part supports it, accepts placement such as width or alignment.
- Compose another element through `render`, as in `<Dialog.Trigger render={<Button />}>`. The rendered element keeps its
  own semantics, so a link stays a link.
- Do not restyle a control with a class that targets its internals. Fix spacing in the layout that places it.
- Text fields use 16px text on a coarse pointer and standalone controls give 44px targets. Leave both alone.

## CSS layers

Put reset rules in the `reset` layer. Elements rules use the StyleX `priority` layers. Keep those layers at the top
level: wrapping the Elements stylesheet in another layer lets a base rule override hover and focus states. Ordinary
unlayered application rules override the package.

## Tokens in your own styles

`@mechane-ai/elements/tokens` exports runtime references for colors, spacing, type, radii, motion and chart colors. Use
them in inline styles or any CSS-in-JS.

For StyleX authoring, import variables from `/tokens.stylex` and compile-time constants, such as
`conditions.coarsePointer`, from `/constants.stylex`. With Vite and StyleX 0.19.1:

```ts
import stylex from '@stylexjs/unplugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    stylex({
      useCSSLayers: true,
      debug: false,
      runtimeInjection: false,
      unstable_moduleResolution: { type: 'commonJS' },
      externalPackages: ['@mechane-ai/elements'],
    }),
  ],
  resolve: { alias: [{ find: /^@mechane-ai\/elements\/tokens\.stylex$/, replacement: '@mechane-ai/elements/tokens' }] },
});
```

The alias uses the compiled variable references without emitting the defaults again over the selected theme. Keep
`/constants.stylex` direct. Override roles with `stylex.createTheme(colors, ...)` using `colors` from `/tokens.stylex`.

Derive a CSS dimension from a token with CSS `calc()`. JavaScript arithmetic on a token produces an invalid declaration.

## A nonce policy

When the Content Security Policy requires nonces, wrap the tree in `CSPProvider` from `@mechane-ai/elements/csp` with
the request's nonce, and keep that nonce through hydration. The application generates the nonce and owns the policy.

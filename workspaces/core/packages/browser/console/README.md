# @mechane/console

TanStack Start application at `/console`. Routes compose the data and presentation packages; the Worker serves its
static build. See the [Console guide](../../../docs/console.md) for behavior, local development, and deployment.

`src/application.tsx` owns browser sign-in state and workspace lifetimes. `src/screens/` owns commands and navigation.
The Vite build creates the shell, extracted StyleX styles, and bundled dependency notices. Storybook builds views
independently through `.storybook/`.

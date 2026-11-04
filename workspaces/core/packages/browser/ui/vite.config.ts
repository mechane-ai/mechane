import stylex from '@stylexjs/unplugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- StyleX declares any for its Vite plugin.
  plugins: [
    stylex({ useCSSLayers: true, runtimeInjection: false, unstable_moduleResolution: { type: 'commonJS' } }),
    react(),
  ],
  build: {
    lib: {
      entry: {
        'index': 'packages/core/src/index.ts',
        'tokens': 'packages/core/src/tokens.stylex.ts',
        'layout': 'packages/layout/src/index.ts',
        'collections': 'packages/collections/src/index.ts',
        'content': 'packages/content/src/index.ts',
        'content/link': 'packages/content/src/link.ts',
        'content/code': 'packages/content/src/code/index.ts',
        'content/diff': 'packages/content/src/diff/index.ts',
        'content/tree': 'packages/content/src/tree/index.ts',
        'ai': 'packages/ai/src/index.ts',
        'charts': 'packages/charts/src/index.ts',
        'charts/cartesian': 'packages/charts/src/cartesian/index.ts',
        'charts/distribution': 'packages/charts/src/distribution/index.ts',
        'charts/matrix': 'packages/charts/src/matrix/index.ts',
        'charts/graph': 'packages/charts/src/graph/index.ts',
      },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
    },
    rolldownOptions: {
      external: [
        /^react(?:\/|$)/,
        /^react-dom(?:\/|$)/,
        /^@base-ui\//,
        /^@stylexjs\//,
        /^@visx\//,
        /^@tanstack\//,
        /^@pierre\//,
        /^@daypicker\//,
        /^@shadcn\//,
        /^lucide-react$/,
        /^streamdown$/,
        /^strip-ansi$/,
        /^react-resizable-panels$/,
      ],
    },
  },
});

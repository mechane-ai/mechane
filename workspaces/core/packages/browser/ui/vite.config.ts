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
        index: 'src/index.ts',
        layout: 'src/layout/index.ts',
        charts: 'src/charts/index.ts',
        tokens: 'src/tokens.stylex.ts',
      },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
    },
    rolldownOptions: {
      external: [/^react(?:\/|$)/, /^react-dom(?:\/|$)/, /^@base-ui\//, /^@stylexjs\//, /^@visx\//, /^lucide-react$/],
    },
  },
});

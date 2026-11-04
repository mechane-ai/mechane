import { stylexPlugin } from '@mechane/catalog';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import manifest from './package.json' with { type: 'json' };

const DIRECT_EXPORTS: ReadonlySet<string> = new Set(['./styles.css', './tokens.stylex']);

const entries = Object.fromEntries(
  Object.entries(manifest.exports)
    .filter(([name]) => !DIRECT_EXPORTS.has(name))
    .map(([name, source]) => [name === '.' ? 'index' : name.replace(/^[.]\//, ''), source]),
);

export default defineConfig({
  plugins: [stylexPlugin, react()],
  build: {
    lib: { entry: entries, formats: ['es'], fileName: (_format, entry) => `${entry}.js` },
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

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
  plugins: [
    stylexPlugin,
    react(),
    {
      name: 'sonner-static-styles',
      transform(code, id) {
        if (!id.endsWith('/sonner/dist/index.mjs')) {
          return;
        }
        // Sonner injects this stylesheet without a nonce; publish it in Elements' CSS for strict CSP consumers.
        const injection = /^__insertCSS\("(?:[^"\\]|\\.)*"\);?$/m;
        if (!injection.test(code)) {
          this.error('Review Sonner stylesheet extraction after its version change.');
        }
        return { code: code.replace(injection, "import './styles.css';"), map: null };
      },
    },
  ],
  build: {
    lib: { entry: entries, formats: ['es'], fileName: (_format, entry) => `${entry}.js`, cssFileName: 'elements' },
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

import { stylexPlugin } from '@mechane/catalog';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import manifest from './package.json' with { type: 'json' };

const entries = Object.fromEntries(
  Object.entries(manifest.exports)
    .filter(([name, source]) => /\.tsx?$/.test(source) && !name.endsWith('.stylex'))
    .map(([name, source]) => [name === '.' ? 'index' : name.replace(/^[.]\//, ''), source]),
);

const runtimeDependencies: ReadonlySet<string> = new Set([
  ...Object.keys(manifest.dependencies),
  ...Object.keys(manifest.peerDependencies),
]);

export default defineConfig({
  plugins: [stylexPlugin, react()],
  build: {
    lib: {
      entry: { ...entries, styles: `${manifest.exports['./styles.css']}?url` },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
    },
    rolldownOptions: { external: (id) => runtimeDependencies.has(/^(?:@[^/]+\/)?[^/]+/.exec(id)?.[0] ?? '') },
  },
});

import stylex from '@stylexjs/unplugin/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { PluginOption } from 'vite';

// oxlint-disable-next-line typescript/no-unsafe-assignment -- StyleX declares any for its Vite plugin.
const stylexPlugin: PluginOption = stylex({
  useCSSLayers: true,
  runtimeInjection: false,
  unstable_moduleResolution: { type: 'commonJS' },
});

export default defineConfig({
  base: '/console/',
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.txt' } },
  plugins: [
    stylexPlugin,
    tanstackStart({
      router: { basepath: '/console' },
      spa: { enabled: true, prerender: { outputPath: '/index.html' } },
    }),
    react(),
  ],
});

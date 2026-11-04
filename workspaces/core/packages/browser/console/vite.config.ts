import { stylexPlugin } from '@mechane/catalog';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/console/',
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.txt' } },
  plugins: [
    stylexPlugin,
    tanstackStart({
      router: { basepath: '/console' },
      spa: { enabled: true, prerender: { outputPath: '/index.html' } },
      prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
      pages: [{ path: '/welcome', prerender: { outputPath: '/welcome.html' } }],
    }),
    react(),
  ],
});

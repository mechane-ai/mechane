import { stylexPlugin } from '@mechane/catalog';
import { HttpHeader } from '@mechane/records';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createWorkerLicenses } from './worker-licenses.ts';

const workerLicenses = createWorkerLicenses();

export default defineConfig({
  base: '/console/',
  preview: {
    host: '127.0.0.1',
    headers: {
      [HttpHeader.CrossOriginOpenerPolicy]: 'same-origin',
      [HttpHeader.CrossOriginEmbedderPolicy]: 'require-corp',
    },
  },
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.txt' } },
  worker: {
    format: 'es',
    plugins: workerLicenses.createPlugins,
    rolldownOptions: { output: { assetFileNames: 'assets/asset-[hash][extname]' } },
  },
  plugins: [
    workerLicenses.outputPlugin,
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

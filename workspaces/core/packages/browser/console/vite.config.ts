import { stylexPlugin } from '@mechane/catalog';
import { BrowserAuthenticationPath } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { build, defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { createWorkerLicenses } from './worker-licenses.ts';

const workerLicenses = createWorkerLicenses();

function browserAuthenticationEntry(): Plugin {
  return {
    name: 'mechane:browser-authentication',
    applyToEnvironment: (environment) => environment.name === 'client',
    async buildStart() {
      const built = await build({
        configFile: false,
        root: import.meta.dirname,
        logLevel: 'silent',
        build: {
          write: false,
          minify: true,
          lib: { entry: new URL('src/auth/main.ts', import.meta.url).pathname, formats: ['es'] },
          rolldownOptions: { output: { inlineDynamicImports: true } },
        },
      });
      const bundles = [built].flat();

      for (const bundle of bundles) {
        if (!('output' in bundle)) {
          this.error('Browser authentication cannot use a watched build');
        }

        const module = bundle.output.find((file) => file.type === 'chunk');

        if (module === undefined || bundle.output.length !== 1) {
          this.error('Browser authentication must compile to one complete module');
        }

        this.emitFile({ type: 'asset', fileName: 'auth-session.js', source: module.code });
      }
    },
    configureServer(server) {
      server.middlewares.use(BrowserAuthenticationPath.Script, (_request, response) => {
        response.writeHead(HttpStatusCode.Found, { [HttpHeader.Location]: '/console/src/auth/main.ts' });
        response.end();
      });
    },
  };
}

export default defineConfig({
  base: '/console/',
  preview: {
    host: '127.0.0.1',
    headers: {
      [HttpHeader.CrossOriginOpenerPolicy]: 'same-origin',
      [HttpHeader.CrossOriginEmbedderPolicy]: 'require-corp',
    },
  },
  build: {
    license: { fileName: 'THIRD_PARTY_LICENSES.txt' },
    rolldownOptions: { output: { chunkFileNames: 'assets/chunk-[hash].js' } },
  },
  worker: {
    format: 'es',
    plugins: workerLicenses.createPlugins,
    rolldownOptions: { output: { assetFileNames: 'assets/asset-[hash][extname]' } },
  },
  plugins: [
    browserAuthenticationEntry(),
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

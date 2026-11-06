import { readFileSync } from 'node:fs';
import license from 'rollup-plugin-license';
import type { Dependency } from 'rollup-plugin-license';
import type { Plugin } from 'vite';

const LICENSE_FILE = 'THIRD_PARTY_LICENSES.txt';
const TURSO_NOTICE: Readonly<URL> = new URL('../../../licenses/turso-0.8.3.txt', import.meta.url);
const UPSTREAM_NOTICES: ReadonlyMap<string, URL> = new Map([
  ['@tursodatabase/database-wasm@0.8.3', TURSO_NOTICE],
  ['@tursodatabase/database-common@0.8.3', TURSO_NOTICE],
  ['@tursodatabase/database-wasm-common@0.8.3', TURSO_NOTICE],
]);

export function createWorkerLicenses() {
  const dependencies = new Map<string, Dependency>();
  const collectDependencies: (included: ReadonlyArray<Dependency>) => void = (included) => {
    for (const dependency of included) {
      dependencies.set(`${dependency.name}@${dependency.version}`, dependency);
    }
  };

  function createPlugins() {
    return [license({ cwd: import.meta.dirname, thirdParty: { multipleVersions: true, output: collectDependencies } })];
  }

  const outputPlugin: Plugin = {
    name: 'mechane:worker-licenses',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const asset = bundle[LICENSE_FILE];
        if (asset?.type !== 'asset' || typeof asset.source !== 'string') {
          this.error(`The console build did not produce ${LICENSE_FILE}.`);
        }

        const sorted = [...dependencies].toSorted(([left], [right]) => left.localeCompare(right));
        const notices = sorted.map(([key, dependency]) => {
          const supplementalFile = UPSTREAM_NOTICES.get(key);
          if (dependency.licenseText === null && supplementalFile === undefined) {
            this.error(`The worker dependency ${key} has no license text.`);
          }

          return dependency.text();
        });
        const supplementalFiles = sorted.map(([key]) => UPSTREAM_NOTICES.get(key));
        const presentFiles = supplementalFiles.filter((file) => file !== undefined);
        const uniqueFiles = [...new Set(presentFiles)];
        const upstream = uniqueFiles.map((source) => readFileSync(source, 'utf8'));
        const sections = [...notices, ...upstream];

        asset.source += `\n\n# Worker dependencies\n\n${sections.join('\n\n---\n\n')}\n`;
      },
    },
  };

  return { createPlugins, outputPlugin };
}

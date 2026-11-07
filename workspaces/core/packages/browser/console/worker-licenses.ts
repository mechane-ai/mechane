import { readFileSync } from 'node:fs';
import license from 'rollup-plugin-license';
import type { Dependency } from 'rollup-plugin-license';
import type { Plugin } from 'vite';

const LICENSE_FILE = 'THIRD_PARTY_LICENSES.txt';
// The native package copies a prebuilt worker, whose embedded wa-sqlite is outside the bundler's dependency graph.
const SQLITE_NOTICE: Readonly<URL> = new URL('../../../licenses/wa-sqlite-1.5.0.txt', import.meta.url);

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
          if (dependency.licenseText === null) {
            this.error(`The worker dependency ${key} has no license text.`);
          }

          return dependency.text();
        });
        const sqlite = readFileSync(SQLITE_NOTICE, 'utf8');
        asset.source += `\n\n# Worker dependencies\n\n${notices.join('\n\n---\n\n')}\n\n# Embedded wa-sqlite 1.5.0\n\n${sqlite}`;
      },
    },
  };

  return { createPlugins, outputPlugin };
}

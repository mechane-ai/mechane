import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement, CruiserRule } from '@mechane/rule-shapes';
import { Array, Record } from 'effect';
import { posix } from 'node:path';
import { escapedPath } from '../../cruiser/escaped-path.ts';
import { packageLayers } from '../local-rules/mechane/package-layers.ts';

type ModuleBoundary = { readonly name: string; readonly dependencies: ReadonlyArray<string> };

const UI_FOLDER = 'packages/browser/ui';
const UI_SOURCES = escapedPath({ path: 'packages/browser/ui/packages' });

const declaredEntries = Record.values(packageLayers.values.definitionExports['@mechane-ai/ui']);
const uniqueEntries = Array.dedupe(declaredEntries);

const entryPattern: (target: string) => string = (target) => {
  const path = posix.join(UI_FOLDER, target);

  return escapedPath({ path });
};

const entryPatterns = uniqueEntries.map(entryPattern);
const PUBLIC_TARGETS = `^(?:${entryPatterns.join('|')})$`;

const MODULES: ReadonlyArray<ModuleBoundary> = [
  { name: 'core', dependencies: [] },
  { name: 'layout', dependencies: ['core'] },
  { name: 'collections', dependencies: ['core'] },
  { name: 'content', dependencies: ['core', 'collections'] },
  { name: 'ai', dependencies: ['core', 'collections', 'content'] },
  { name: 'charts', dependencies: ['core'] },
];

/** Each area exposes its own entry; heavier presentation capabilities cannot enter its dependencies. */
export const uiPresentationBoundaries = {
  values: {},
  rules: MODULES.flatMap(moduleRules),
} as const satisfies ContractEnforcement;

function moduleRules({ name, dependencies }: ModuleBoundary): ReadonlyArray<CruiserRule> {
  const source = `^(?:${UI_SOURCES})/(?:${name})/`;
  const permitted = [name, ...dependencies].join('|');

  return [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: `ui-${name}-public-entry`,
      comment:
        'Import another UI area through its public entry, such as `../../core/src/index.ts`; import token definitions directly',
      from: { path: source },
      to: { path: `^(?:${UI_SOURCES})/(?!(?:${name})/)`, pathNot: PUBLIC_TARGETS },
      standard: '065',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: `ui-${name}-dependencies`,
      comment: 'Compose independent areas in the application, such as `<AppShell>{chart}</AppShell>`',
      from: { path: source, pathNot: '[.]stories[.]tsx$' },
      to: { path: `^(?:${UI_SOURCES})/(?!(?:${permitted})/)` },
      standard: '065',
    },
  ];
}

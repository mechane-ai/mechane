import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement, CruiserRule } from '@mechane/rule-shapes';
import { Array, Record } from 'effect';
import { posix } from 'node:path';
import { escapedPath } from '../../cruiser/escaped-path.ts';
import { packageLayers } from '../local-rules/mechane/package-layers.ts';

type ModuleBoundary = { readonly name: string; readonly dependencies: ReadonlyArray<string> };
type FamilyPathInput = { readonly name: string };

const UI_FOLDER = 'packages/browser/elements';
const UI_SOURCES = escapedPath({ path: 'packages/browser/elements/packages' });

const declaredEntries = Record.values(packageLayers.values.definitionExports['@mechane-ai/elements']);
const uniqueEntries = Array.dedupe(declaredEntries);

const entryPattern: (target: string) => string = (target) => {
  const path = posix.join(UI_FOLDER, target);

  return escapedPath({ path });
};

const FOUNDATION_ENTRIES = [
  'accessibility.ts',
  'visible-motion.ts',
  'use-scroll-tab-index.ts',
  'control-state.ts',
  'control-density.ts',
  'control-styles.ts',
  'header-styles.ts',
  'style-composition.ts',
  'overlay-styles.ts',
  'popup-styles.ts',
].map((name) => posix.join('packages/foundations/src', name));

const entryPatterns = [...uniqueEntries, ...FOUNDATION_ENTRIES].map(entryPattern);
const SHARED_TARGETS = `^(?:${entryPatterns.join('|')})$`;

const MODULES: ReadonlyArray<ModuleBoundary> = [
  { name: 'foundations', dependencies: [] },
  { name: 'core', dependencies: ['foundations'] },
  { name: 'overlays', dependencies: ['foundations'] },
  { name: 'forms', dependencies: ['foundations', 'core', 'overlays'] },
  { name: 'feedback', dependencies: ['foundations', 'core'] },
  { name: 'navigation', dependencies: ['foundations', 'forms', 'overlays'] },
  { name: 'layout', dependencies: ['foundations', 'core', 'overlays'] },
  { name: 'collections', dependencies: ['foundations', 'core', 'forms', 'overlays', 'feedback'] },
  { name: 'content', dependencies: ['foundations', 'core', 'forms'] },
  { name: 'ai', dependencies: ['foundations', 'core', 'forms', 'overlays', 'content', 'feedback'] },
  { name: 'charts', dependencies: ['foundations', 'core', 'forms', 'overlays', 'feedback'] },
];

const VENDORS = [
  { name: 'dates', owner: 'forms/src/dates', packages: '@daypicker/' },
  { name: 'commands', owner: 'navigation/src/commands', packages: '@tanstack/react-hotkeys' },
  { name: 'tables', owner: 'collections', packages: '@tanstack/(?:react-table|react-virtual)' },
  { name: 'content', owner: 'content', packages: '(?:@pierre/|streamdown|strip-ansi)' },
  { name: 'conversation', owner: 'ai', packages: '@shadcn/' },
  { name: 'charts', owner: 'charts', packages: '@visx/' },
  { name: 'panes', owner: 'layout', packages: 'react-resizable-panels' },
] as const;

/** Each area exposes its own entry; heavier presentation capabilities cannot enter its dependencies. */
export const uiPresentationBoundaries = {
  values: {},
  rules: [
    ...MODULES.flatMap(moduleRules),
    ...VENDORS.map(({ name, owner, packages }): CruiserRule => ({
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: `ui-${name}-vendor-owner`,
      comment: `Import the Elements ${name} API, such as \`@mechane-ai/elements/${owner.replace('/src', '')}\`, instead of its implementation dependency`,
      from: { path: `^(?:${UI_SOURCES})/`, pathNot: familyPath({ name: owner }) },
      to: { path: `node_modules/(?:${packages})` },
      standard: '065',
    })),
  ],
} as const satisfies ContractEnforcement;

function moduleRules({ name, dependencies }: ModuleBoundary): ReadonlyArray<CruiserRule> {
  const source = familyPath({ name });
  const permitted = [name, ...dependencies].join('|');

  return [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: `ui-${name}-public-entry`,
      comment:
        'Import another Elements family through its public entry, such as `../../core/src/index.ts`; shared foundation definitions have explicit internal entries',
      from: { path: source },
      to: { path: `^(?:${UI_SOURCES})/(?!(?:${name})/)`, pathNot: SHARED_TARGETS },
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

function familyPath({ name }: FamilyPathInput): string {
  return `^(?:${UI_SOURCES})/(?:${name})/`;
}

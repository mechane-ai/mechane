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
  'chart-tones.ts',
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
  { name: 'navigation', dependencies: ['foundations', 'core', 'forms', 'overlays'] },
  { name: 'layout', dependencies: ['foundations', 'core', 'overlays', 'navigation'] },
  { name: 'collections', dependencies: ['foundations', 'core', 'forms', 'overlays', 'feedback'] },
  { name: 'content', dependencies: ['foundations', 'core', 'forms'] },
  { name: 'ai', dependencies: ['foundations', 'core', 'forms', 'overlays', 'content', 'feedback'] },
  { name: 'charts', dependencies: ['foundations', 'core', 'forms', 'overlays', 'feedback'] },
  {
    name: 'kits',
    dependencies: [
      'foundations',
      'core',
      'forms',
      'overlays',
      'feedback',
      'layout',
      'collections',
      'content',
      'charts',
    ],
  },
  {
    name: 'teaching',
    dependencies: ['foundations', 'core', 'forms', 'overlays', 'feedback', 'navigation', 'layout', 'content', 'charts'],
  },
];

const VENDORS = [
  { name: 'tables', owner: 'collections', packages: '@tanstack/react-table' },
  { name: 'content', owner: 'content', packages: '(?:@pierre/|streamdown|strip-ansi)' },
] as const;

/** Each area exposes its own entry; heavier presentation capabilities cannot enter its dependencies. */
export const uiPresentationBoundaries = {
  values: {},
  rules: [
    ...MODULES.flatMap(moduleRules),
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-sdk-element-owner',
      comment:
        'Compose Elements controls, such as `Button` from `@mechane-ai/elements`; the family owns UI SDK behavior',
      from: { path: '^packages/browser/', pathNot: '^packages/browser/elements/' },
      to: { path: 'node_modules/@ui-sdk/' },
      standard: '065',
    },
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

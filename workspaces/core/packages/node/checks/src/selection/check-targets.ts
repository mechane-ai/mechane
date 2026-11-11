import { MIGRATION_LOCK, WIRE_LOCK } from '@mechane/program';
import { Option } from 'effect';
import { posix } from 'node:path';
import { BundleTarget } from '../fingerprint/constants.ts';
import type { BundleEntry } from '../fingerprint/types.ts';
import { CheckTask, CONSOLE_FAMILY, SMOKE_TASK_PREFIX } from './constants.ts';
import type { SmokeScenario } from './smoke-catalog.ts';

export type CheckTarget = {
  readonly task: string;
  readonly family: Option.Option<string>;
  readonly guarantees: ReadonlyArray<string>;
  readonly roots: ReadonlyArray<string>;
  readonly inputs: ReadonlyArray<string>;
  readonly artifacts: ReadonlyArray<string>;
};

type CheckTargetsInput = {
  readonly bundles: ReadonlyArray<BundleEntry>;
  readonly catalog: ReadonlyArray<SmokeScenario>;
};

type SmokeTargetInput = { readonly family: string; readonly catalog: ReadonlyArray<SmokeScenario> };

const SHARED_INPUTS = [
  '../../mise.toml',
  '../../mise.lock',
  'mise.toml',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  'dependencies.json',
  MIGRATION_LOCK,
  WIRE_LOCK,
  'tsconfig*.json',
  'packages/node/checks/src/selection/**',
] as const;

export function checkTargets({ bundles, catalog }: CheckTargetsInput): ReadonlyArray<CheckTarget> {
  const workers = bundles.filter(({ target }) => target === BundleTarget.Browser).map(({ entry }) => entry);
  const familyNames = catalog.map(({ family }) => family);
  const families = [...new Set(familyNames)];

  return [
    ...families.map((family) => smokeTarget({ family, catalog })),
    {
      task: CheckTask.Infrastructure,
      family: Option.none(),
      guarantees: ['provider validation', 'installation module validation', 'current API and migration compatibility'],
      roots: [
        'packages/node/distribution/src/main.ts',
        'packages/node/distribution/testing/shipped-formats.ts',
        ...workers,
      ],
      inputs: [...SHARED_INPUTS, 'infrastructure/**', 'packages/worker/**/wrangler.jsonc'],
      artifacts: ['packages/worker/server/.output/**/*'],
    },
  ];
}

function smokeTarget({ family, catalog }: SmokeTargetInput): CheckTarget {
  const scenarios = catalog.filter((scenario) => scenario.family === family);
  const familyPattern = posix.join('packages/node/smoke/src', family, '**');

  const inputs = [
    ...SHARED_INPUTS,
    'packages/node/smoke/src/*.ts',
    familyPattern,
    'packages/node/stack/**',
    'packages/node/testing/**',
    'packages/node/guest/image/**',
    'packages/worker/**/wrangler.jsonc',
    'licenses/**',
  ];

  if (family === CONSOLE_FAMILY) {
    inputs.push('packages/browser/**');
  }

  return {
    task: `${SMOKE_TASK_PREFIX}${family}`,
    family: Option.some(family),
    guarantees: scenarios.map(({ guarantee }) => guarantee),
    roots: [
      ...scenarios.map(({ entry }) => entry),
      'packages/worker/server/src/main.ts',
      'packages/node/cli/src/main.ts',
      'packages/node/guest/src/main.ts',
    ],
    inputs,
    artifacts: ['packages/node/guest/image/guest.mjs', 'packages/node/guest/image/mechane.mjs'],
  };
}

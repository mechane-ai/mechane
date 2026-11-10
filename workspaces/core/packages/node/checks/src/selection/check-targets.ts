import { MIGRATION_LOCK, SHIPPED_WIRE_LOCK, WIRE_LOCK } from '@mechane/program';
import { BundleTarget } from '../fingerprint/constants.ts';
import type { BundleEntry } from '../fingerprint/types.ts';

export type CheckTarget = {
  readonly task: string;
  readonly guarantees: ReadonlyArray<string>;
  readonly roots: ReadonlyArray<string>;
  readonly inputs: ReadonlyArray<string>;
  readonly artifacts: ReadonlyArray<string>;
};

type CheckTargetsInput = { readonly bundles: ReadonlyArray<BundleEntry> };

const SHARED_INPUTS = [
  '../../mise.toml',
  '../../mise.lock',
  'mise.toml',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  'dependencies.json',
  MIGRATION_LOCK,
  SHIPPED_WIRE_LOCK,
  WIRE_LOCK,
  'tsconfig*.json',
  'packages/node/checks/src/selection/**',
] as const;

/** These are the real task boundaries; the smoke covers its entire approved catalog. */
export function checkTargets({ bundles }: CheckTargetsInput): ReadonlyArray<CheckTarget> {
  const workers = bundles.filter(({ target }) => target === BundleTarget.Browser).map(({ entry }) => entry);

  return [
    {
      task: 'smoke',
      guarantees: ['every guarantee in the approved smoke catalog'],
      roots: [
        'packages/node/smoke/src/main.ts',
        'packages/worker/server/src/main.ts',
        'packages/node/cli/src/main.ts',
        'packages/node/guest/src/main.ts',
        ...workers,
      ],
      inputs: [
        ...SHARED_INPUTS,
        'packages/browser/**',
        'packages/node/distribution/src/build/**',
        'packages/node/stack/**',
        'packages/node/testing/**',
        'packages/node/guest/image/**',
        'packages/worker/**/wrangler.jsonc',
        'licenses/**',
      ],
      artifacts: [
        'packages/worker/server/.output/**/*',
        'packages/node/cli/dist/mechane',
        'packages/node/guest/image/guest.mjs',
        'packages/node/guest/image/mechane.mjs',
      ],
    },
    {
      task: 'infrastructure:check',
      guarantees: ['provider validation', 'installation module validation', 'shipped format history preservation'],
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

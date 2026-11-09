import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `test-support-modules`: production code never imports the smoke or its support folder. */
export const testSupportModules = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      name: 'tests-outside-production',
      comment:
        'Import the smoke and its testing support only from each other, such as `packages/node/testing/src/cli/run-cli.ts` from `packages/node/smoke/src`',
      from: { pathNot: '^(packages/node/smoke/src|packages/node/testing/src|packages/node/distribution/testing)/' },
      to: { path: '^(packages/node/smoke/src|packages/node/testing/src|packages/node/distribution/testing)/' },
      standard: '050',
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;

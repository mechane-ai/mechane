import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-typescript-package-boundaries`: a package imports only what its manifest declares. */
export const codeTypescriptPackageBoundaries = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      name: 'no-non-package-json',
      comment:
        'Declare the package in the importing package\'s manifest before importing it, such as `"effect": "catalog:"`',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
      standard: 'ST-06',
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;

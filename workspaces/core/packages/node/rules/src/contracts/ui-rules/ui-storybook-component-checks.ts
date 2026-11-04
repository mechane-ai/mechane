import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** These files build and describe the catalog; production browser modules must not depend on them. */
const CATALOG_PATH = '^packages/browser/(?:.*[.]stories[.]tsx$|[^/]+/[.]storybook/|[^/]+/vite[.]config[.]ts$)';

/** The dependency graph keeps synthetic catalog inputs and development configuration out of runtime imports. */
export const uiStorybookComponentChecks = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'no-browser-catalog-imports',
      comment: 'Keep catalog examples in development, such as `import { Button } from "@mechane-ai/ui"`',
      from: { path: '^packages/browser/', pathNot: CATALOG_PATH },
      to: { path: CATALOG_PATH },
      standard: '075',
    },
  ],
} as const satisfies ContractEnforcement;

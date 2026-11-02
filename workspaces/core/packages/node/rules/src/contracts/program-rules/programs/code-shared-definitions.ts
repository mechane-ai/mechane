import { ADOPTED, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The length a regular expression must reach before two files may not both write it, and the tests that may. */
const VALUES = { patternChars: 12, testRoots: ['packages/node/smoke/src', 'packages/node/testing/src'] } as const;

/** What enforces `code-shared-definitions`: the limit and the roots the patterns check reads. */
export const codeSharedDefinitions = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'patterns',
      standard: 'ST-32',
      violation: [
        {
          'scripts/a.ts': 'export const isSlug = (text: string): boolean => /^[a-z]+-[0-9]+$/.test(text);\n',
          'scripts/b.ts': 'export const hasSlug = (text: string): boolean => /^[a-z]+-[0-9]+$/.test(text);\n',
        },
      ],
      allowed: [
        {
          'scripts/a.ts': 'export const SLUG = /^[a-z]+-[0-9]+$/;\n',
          'scripts/b.ts':
            "import { SLUG } from './a.ts';\n\nexport const hasSlug = (text: string): boolean => SLUG.test(text);\n",
        },
      ],
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;

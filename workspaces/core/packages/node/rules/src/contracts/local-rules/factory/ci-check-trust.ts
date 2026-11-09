import { ADOPTED, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `ci-check-trust`. */
export const ciCheckTrust = {
  values: {},
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'workflows',
      standard: 'F004',
      violation: [
        { '.github/workflows/check.yml': 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n' },
        {
          '.github/workflows/check.yml':
            'permissions:\n  contents: read\njobs:\n  check:\n    steps:\n      - uses: ./../untrusted-action\n',
        },
      ],
      allowed: [
        {
          '.github/workflows/check.yml':
            'permissions:\n  contents: read\njobs:\n  check:\n    steps:\n      - uses: actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955\n',
        },
        {
          '.github/workflows/check.yml':
            'permissions:\n  contents: read\njobs:\n  check:\n    steps:\n      - uses: ./.github/actions/bootstrap-mise\n',
        },
      ],
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;

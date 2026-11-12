import { ADOPTED, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `ci-check-trust`. */
export const ciCheckTrust = {
  values: { manualWorkflows: ['.github/workflows/runtime-candidate.yml'] },
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'workflows',
      standard: 'F004',
      violation: [
        {
          '.github/workflows/runtime-candidate.yml': 'on: [push, workflow_dispatch]\npermissions:\n  contents: read\n',
        },
        { '.github/actions/setup/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: jdx/mise-action@v4\n' },
        { '.github/workflows/check.yml': 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n' },
        {
          '.github/workflows/check.yml':
            'permissions:\n  contents: read\njobs:\n  check:\n    steps:\n      - uses: ./../untrusted-action\n',
        },
      ],
      allowed: [
        { '.github/workflows/runtime-candidate.yml': 'on:\n  workflow_dispatch:\npermissions:\n  contents: read\n' },
        { '.github/workflows/runtime-candidate.yml': 'on: [workflow_dispatch]\npermissions:\n  contents: read\n' },
        {
          '.github/actions/setup/action.yml':
            'runs:\n  using: composite\n  steps:\n    - uses: ./.github/actions/bootstrap-mise\n',
        },
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

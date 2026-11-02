import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `security-resource-access-control`: only a mech reaches its sandbox, and only a fork its copy. */
export const securityResourceAccessControl = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'copy-outside-forks',
      standard: '055',
      violation: ['stub.receiveCopy({ page });'],
      allowed: ['stub.receiveFork({ page });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'sandbox-stub-outside-mech',
      standard: '055',
      violation: ['const stub = sandboxStub({ mechId });'],
      allowed: ['const stub = mechStub({ mechId });'],
    },
  ],
} as const satisfies ContractEnforcement;

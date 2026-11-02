import { RESTRICTED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-shared-utilities`: Effect's `Record` reads keys and entries. */
export const codeSharedUtilities = {
  values: {},
  rules: [
    {
      ...RESTRICTED_DEFAULTS,
      message: "Read keys and entries with Effect's `Record`, such as `Record.keys(table)`",
      properties: { Object: ['keys', 'values', 'entries', 'fromEntries'] },
      imports: [],
      exemptRoles: [],
      standard: 'TD-25',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
    },
  ],
} as const satisfies ContractEnforcement;

import { FileRole, RESTRICTED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Effect members enumerate through Record; browser presentation uses native object operations. */
export const codeSharedUtilities = {
  values: {},
  rules: [
    {
      ...RESTRICTED_DEFAULTS,
      message: "Read keys and entries with Effect's `Record`, such as `Record.keys(table)`",
      properties: { Object: ['keys', 'values', 'entries', 'fromEntries'] },
      imports: [],
      exemptRoles: [FileRole.Browser, FileRole.BrowserAdapter],
      standard: 'TD-25',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
    },
  ],
} as const satisfies ContractEnforcement;

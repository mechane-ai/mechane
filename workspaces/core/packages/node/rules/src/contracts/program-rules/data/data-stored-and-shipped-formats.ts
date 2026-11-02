import { OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `data-stored-and-shipped-formats`. */
export const dataStoredAndShippedFormats = {
  values: {},
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'locks',
      standard: 'CP-07',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.NameFreeze,
    },
    {
      ...OWNED_DEFAULTS,
      name: 'record-forms',
      standard: '047',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.NameFreeze,
    },
  ],
} as const satisfies ContractEnforcement;

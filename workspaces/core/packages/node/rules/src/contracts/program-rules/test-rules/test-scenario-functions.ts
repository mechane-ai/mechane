import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `test-scenario-functions`: a check names its guarantee, never a sequence marker. */
export const testScenarioFunctions = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'check-name-sequence-marker',
      standard: 'TS-03',
      violation: ["const check = { name: '1. a revoked key is refused' };"],
      allowed: ["const check = { name: 'a revoked key is refused' };"],
    },
  ],
} as const satisfies ContractEnforcement;

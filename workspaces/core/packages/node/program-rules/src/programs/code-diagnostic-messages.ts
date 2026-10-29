import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-diagnostic-messages`: a diagnostic ends without a period. */
export const codeDiagnosticMessages = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'diagnostic-trailing-period',
      standard: 'ER-11',
      violation: ["const failure = { reason: 'the file is missing.' };"],
      allowed: ["const failure = { reason: 'the file is missing' };"],
    },
  ],
} as const satisfies ContractEnforcement;

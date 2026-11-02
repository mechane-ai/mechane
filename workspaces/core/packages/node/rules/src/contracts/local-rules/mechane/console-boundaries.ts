import { ADOPTED, FileRole, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** React state and optional props use ordinary optional access; the backend keeps its Option convention. */
export const consoleBoundaries = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'oxc/no-optional-chaining',
      value: Severity.Error,
      exemptRoles: [FileRole.Browser],
      standard: '113',
    },
  ],
} as const satisfies ContractEnforcement;

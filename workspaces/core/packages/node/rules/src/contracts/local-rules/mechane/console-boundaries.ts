import { ADOPTED, AST_GREP_DEFAULTS, FileRole, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** React state and optional props use ordinary optional access; the backend keeps its Option convention. */
export const consoleBoundaries = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'stylex-longhands',
      standard: '113',
      violation: [
        "const styles = stylex.create({ button: { border: '1px solid black' } });",
        "const styles = stylex.create({ button: { ':hover': { 'outline': '1px solid black' } } });",
      ],
      allowed: [
        "const styles = stylex.create({ button: { borderWidth: 1, borderStyle: 'solid', borderColor: 'black' } });",
        "const options = { border: '1px solid black' };",
      ],
    },
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

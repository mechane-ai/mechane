import { ADOPTED, AST_GREP_DEFAULTS, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Browser review checks names, keyboard behavior, and focus beyond static types. */
export const uiControlAccessibility = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-deprecated',
      value: Severity.Error,
      maxSuppressions: 1,
      standard: '068',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'ui-hover-capability',
      standard: '068',
      violation: ["const styles = { ':hover': { color: colors.ink } };"],
      allowed: [
        "const styles = { ':hover': { color: { [conditions.hoverPointer]: colors.ink } } };",
        "const styles = { [conditions.hoverPointer]: { ':hover': { color: colors.ink } } };",
        "const styles = { ':focus-visible': { color: colors.ink } };",
      ],
    },
  ],
} as const satisfies ContractEnforcement;

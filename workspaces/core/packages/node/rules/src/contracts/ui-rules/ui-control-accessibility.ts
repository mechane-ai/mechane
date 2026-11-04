import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Browser review checks names, keyboard behavior, and focus beyond static types. */
export const uiControlAccessibility = {
  values: {},
  rules: [
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

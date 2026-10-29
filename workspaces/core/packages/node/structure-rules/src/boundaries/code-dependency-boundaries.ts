import { ADOPTED, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-dependency-boundaries`. */
export const codeDependencyBoundaries = {
  values: {},
  rules: [{ ...OWNED_DEFAULTS, name: 'packages', standard: 'ST-06', ...ADOPTED }],
} as const satisfies ContractEnforcement;

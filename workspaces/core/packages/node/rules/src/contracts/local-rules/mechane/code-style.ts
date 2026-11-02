import type { ContractEnforcement } from '@mechane/rule-shapes';
import { STYLE_CONTENT_RULES } from './style-content-rules.ts';
import { STYLE_FUNCTION_RULES } from './style-function-rules.ts';

/** Value construction and domain vocabulary keep their checks independently of module placement. */
export const codeStyle = {
  values: {},
  rules: [...STYLE_FUNCTION_RULES, ...STYLE_CONTENT_RULES],
} as const satisfies ContractEnforcement;

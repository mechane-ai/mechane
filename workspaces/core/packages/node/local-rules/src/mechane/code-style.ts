import { OXLINT_DEFAULTS, RolloutPhase, RuleStatus, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { Option } from 'effect';
import { STYLE_CONTENT_RULES } from './style-content-rules.ts';
import { STYLE_FUNCTION_RULES } from './style-function-rules.ts';

/**
 * What enforces `code-style`: values chosen with statements, functions passed by name in the form their caller needs,
 * and cohesive private helpers. Loops become named steps, failures tagged errors, and strings, numbers and HTTP words
 * their named forms. A rule that measured zero is enforced, and every other one is a ratchet the cleanup sweeps.
 */
export const codeStyle = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/consistent-function-scoping',
      value: [Severity.Error, { checkArrowFunctions: false }],
      note: Option.some('A named callback stays a typed const beside the statement that passes it (SC-03).'),
      standard: 'SC-03',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
    },
    ...STYLE_FUNCTION_RULES,
    ...STYLE_CONTENT_RULES,
  ],
} as const satisfies ContractEnforcement;

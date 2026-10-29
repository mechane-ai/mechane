import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  OWNED_DEFAULTS,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-conditional-expressions`: no conditional operator, no imitation of one with `&&`, and at most
 * `logicalOperators` logical operators in one expression.
 */
export const codeConditionalExpressions = {
  values: { logicalOperators: 2 },
  rules: [
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'no-ternary', value: Severity.Error, standard: 'EF-21' },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'logical-conditional',
      standard: 'EF-21',
      violation: ['const value = (isReady && total) || fallback;', 'const value = isReady && total ?? fallback;'],
      allowed: ['const isDone = isReady && hasTotal;'],
    },
    {
      ...OWNED_DEFAULTS,
      name: 'logical-operators',
      standard: '012',
      violation: [
        { 'scripts/a.ts': 'export const isDue = isPaid && isShipped && isOpen && !isLate;\n' },
        { 'scripts/a.ts': 'export const isDue = !(isPaid && isShipped) && (isOpen ?? isLate);\n' },
        { 'scripts/a.ts': 'export const isDue = Boolean(isPaid && isShipped) && isOpen && !isLate;\n' },
      ],
      allowed: [
        {
          'scripts/a.ts':
            'const isDelivered = isPaid && isShipped;\n\nexport const isDue = isDelivered && isOpen && !isLate;\n',
        },
        {
          'scripts/a.ts':
            'export const isDue = isPaid && isShipped && lines.every((line) => line.isOpen && !line.isLate);\n',
        },
        { 'scripts/a.ts': 'export const order = isPaid && isShipped && { isDue: isOpen && !isLate };\n' },
      ],
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
    },
  ],
} as const satisfies ContractEnforcement;

import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior, RolloutPhase, RuleFix, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-typescript-module-state`: module bindings are `const` and their collections read-only, and a set
 * under an array type, which oxlint's fix of `unicorn/prefer-set-has` leaves, takes its read-only set type.
 */
export const codeTypescriptModuleState = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'module-collection-type',
      behavior: FixBehavior.TypeOnly,
      standard: 'ST-33',
      violation: ['const LIMITS = [1, 2];', 'export const NAMES = new Set();'],
      allowed: ['const LIMITS = [1, 2] as const;', "const NAMES: ReadonlyArray<string> = ['turn'];"],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'set-collection-type',
      fix: RuleFix.AstGrep,
      behavior: FixBehavior.TypeOnly,
      standard: 'ST-33',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ["const NAMES: ReadonlyArray<string> = new Set(['turn']);"],
      allowed: [
        "const NAMES: ReadonlySet<string> = new Set(['turn']);",
        "const NAMES: ReadonlyArray<string> = ['turn'];",
      ],
      fixed: ["const NAMES: ReadonlySet<string> = new Set(['turn']);"],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'module-mutable-binding',
      standard: 'ST-33',
      violation: ['let count = 0;', 'var count = 0;'],
      allowed: ['const LIMIT = 3;'],
    },
  ],
} as const satisfies ContractEnforcement;

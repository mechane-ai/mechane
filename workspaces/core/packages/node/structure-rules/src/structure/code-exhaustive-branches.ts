import {
  ADOPTED,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-exhaustive-branches`: a `switch` names every member and holds no block, and `Match` branches one
 * way.
 */
export const codeExhaustiveBranches = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/switch-exhaustiveness-check',
      value: [
        Severity.Error,
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      standard: 'EF-14',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/switch-case-braces',
      fix: RuleFix.Oxlint,
      value: [Severity.Error, 'avoid'],
      standard: 'ST-27',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message: 'Branch on tags with `Match.valueTags`, such as `Match.valueTags(failure, MESSAGES)`',
      properties: { Match: ['value', 'type', 'tag', 'tags', 'when', 'orElse'] },
      imports: [],
      exemptRoles: [],
      standard: 'EF-14',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
  ],
} as const satisfies ContractEnforcement;

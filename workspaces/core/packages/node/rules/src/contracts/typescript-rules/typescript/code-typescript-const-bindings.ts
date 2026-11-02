import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  InstalledAsset,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-typescript-const-bindings`: `const`, one binding per declaration, each initialized where it is
 * declared, and a property read into a binding by destructuring.
 */
export const codeTypescriptConstBindings = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'func-style',
      asset: InstalledAsset.Oxlint,
      value: [Severity.Error, 'declaration', { allowTypeAnnotation: true }],
      standard: 'SC-03',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-plusplus',
      asset: InstalledAsset.Oxlint,
      value: [Severity.Error, { allowForLoopAfterthoughts: false }],
      standard: '015',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'no-var', fix: RuleFix.Oxlint, value: Severity.Error, standard: 'EF-22' },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'prefer-const',
      fix: RuleFix.Oxlint,
      value: Severity.Error,
      standard: 'EF-22',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'init-declarations', value: [Severity.Error, 'always'], standard: 'EF-22' },
    {
      ...OXLINT_DEFAULTS,
      name: 'one-var',
      fix: RuleFix.Oxlint,
      value: [Severity.Error, 'never'],
      standard: '015',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'prefer-destructuring',
      fix: RuleFix.Oxlint,
      value: [Severity.Error, { array: false }],
      standard: '015',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'let-empty-initializer',
      standard: 'EF-22',
      violation: ['let row = null;', 'let row = undefined;'],
      allowed: ['let attempt = 0;'],
    },
  ],
} as const satisfies ContractEnforcement;

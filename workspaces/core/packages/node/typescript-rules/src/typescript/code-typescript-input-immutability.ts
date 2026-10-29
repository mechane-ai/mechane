import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FixBehavior,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-typescript-input-immutability`: no parameter reassigned or changed, no sort in place, and
 * read-only types.
 */
export const codeTypescriptInputImmutability = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-param-reassign',
      value: [Severity.Error, { props: true }],
      standard: 'EF-23',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/no-array-sort',
      value: [Severity.Error, { allowExpressionStatement: false }],
      standard: 'EF-23',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/no-array-reverse',
      value: [Severity.Error, { allowExpressionStatement: false }],
      standard: 'EF-23',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'parameter-mutation',
      standard: 'EF-23',
      violation: [
        'function add({ rows, row }: AddInput) { rows.push(row); }',
        'function add({ totals }: AddInput) { Object.assign(totals, { turns: 1 }); }',
      ],
      allowed: ['function add({ rows, row }: AddInput) { return [...rows, row]; }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'readonly-type-members',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-06',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ['type Turn = { turnId: TurnId };'],
      allowed: ['type Turn = { readonly turnId: TurnId };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'readonly-collections',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-06',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: [
        'type Turns = { readonly turns: Array<Turn> };',
        'function total({ counts }: { readonly counts: Record<string, number> }): number { return 0; }',
        'type Entry = [string, string];',
      ],
      allowed: [
        'type Turns = { readonly turns: ReadonlyArray<Turn> };',
        'type Entry = readonly [string, string];',
        'type Totals = Readonly<Partial<Record<string, number>>>;',
        'function lines(): ReadonlyArray<string> { const buffer: Array<string> = []; return buffer; }',
      ],
    },
  ],
} as const satisfies ContractEnforcement;

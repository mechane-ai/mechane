import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior, OXLINT_DEFAULTS, RuleFix, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-typescript-type-assertions`: no assertion, `!`, `any`, unsafe use or declared predicate. */
export const codeTypescriptTypeAssertions = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/consistent-type-assertions',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { assertionStyle: 'never' }],
      maxSuppressions: 1,
      standard: 'TD-07',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-unsafe-type-assertion',
      value: Severity.Error,
      maxSuppressions: 1,
      standard: 'TD-07',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-non-null-assertion',
      value: Severity.Error,
      standard: 'TD-07',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-explicit-any',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: Severity.Error,
      standard: 'TD-07',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-unsafe-member-access',
      value: Severity.Error,
      standard: 'TD-07',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'typescript/no-unsafe-call', value: Severity.Error, standard: 'TD-07' },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-unsafe-assignment',
      value: Severity.Error,
      standard: 'TD-07',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'typescript/no-unsafe-return', value: Severity.Error, standard: 'TD-07' },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'typescript/no-unsafe-argument', value: Severity.Error, standard: 'TD-07' },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/no-unnecessary-type-parameters',
      behavior: FixBehavior.TypeOnly,
      value: Severity.Error,
      standard: 'TD-07',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'return-only-type-parameter',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-07',
      violation: ['function read<T>(): T { return value; }'],
      allowed: ['function first<T>({ items }: ItemsInput<T>): T { return items[0]; }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'type-predicate',
      standard: 'TD-07',
      violation: [
        'function isRow(value: unknown): value is Row { return true; }',
        'function assertRow(value: unknown): asserts value is Row {}',
      ],
      allowed: ['const oxlint = rules.filter((rule) => rule.tool === RuleTool.Oxlint);'],
    },
  ],
} as const satisfies ContractEnforcement;

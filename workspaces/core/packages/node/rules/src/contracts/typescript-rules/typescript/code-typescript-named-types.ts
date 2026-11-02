import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FixBehavior,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { Option } from 'effect';

/** The rollout of a type-syntax rule that the fixers swept (TD-05). */
const SWEPT_BY_FIXERS = { standard: 'TD-05', status: RuleStatus.Enforced, phase: RolloutPhase.Fixers } as const;

/** The rollout of a type-syntax rule that measured zero in the proof phase (TD-05). */
const ENFORCED_IN_PROOF = { standard: 'TD-05', status: RuleStatus.Enforced, phase: RolloutPhase.Proof } as const;

/**
 * What enforces `code-typescript-named-types`: one form for each piece of type syntax and for each import, and named
 * object types.
 */
export const codeTypescriptNamedTypes = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...SWEPT_BY_FIXERS,
      name: 'typescript/consistent-type-definitions',
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, 'type'],
      maxSuppressions: 2,
    },
    {
      ...OXLINT_DEFAULTS,
      ...ENFORCED_IN_PROOF,
      name: 'typescript/array-type',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { default: 'generic', readonly: 'generic' }],
    },
    {
      ...OXLINT_DEFAULTS,
      ...SWEPT_BY_FIXERS,
      name: 'typescript/consistent-indexed-object-style',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, 'record'],
    },
    {
      ...OXLINT_DEFAULTS,
      ...SWEPT_BY_FIXERS,
      name: 'typescript/consistent-type-imports',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
    },
    {
      ...OXLINT_DEFAULTS,
      ...ENFORCED_IN_PROOF,
      name: 'import/consistent-type-specifier-style',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, 'prefer-top-level'],
    },
    {
      ...OXLINT_DEFAULTS,
      ...SWEPT_BY_FIXERS,
      name: 'import/no-duplicates',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: Severity.Error,
    },
    {
      ...OXLINT_DEFAULTS,
      ...SWEPT_BY_FIXERS,
      name: 'sort-imports',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { ignoreDeclarationSort: true, ignoreCase: true }],
      note: Option.some('oxfmt sorts the import statements, and this rule sorts the names inside each one.'),
    },
    {
      ...OXLINT_DEFAULTS,
      ...ENFORCED_IN_PROOF,
      name: 'typescript/method-signature-style',
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, 'property'],
    },
    {
      ...OXLINT_DEFAULTS,
      ...ENFORCED_IN_PROOF,
      name: 'typescript/no-namespace',
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { allowDeclarations: true }],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'named-object-types',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-03',
      violation: [
        'function parse(input: { line: string }) { return input; }',
        'type ReadInput = PageInput & { readonly line: string } & { readonly column: number };',
      ],
      allowed: [
        'type LineInput = { readonly line: string };',
        'type ReadInput = PageInput & { readonly line: string };',
      ],
    },
  ],
} as const satisfies ContractEnforcement;

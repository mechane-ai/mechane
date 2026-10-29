import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FixBehavior,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { FUNCTION_FORM_RULES } from './function-form-rules.ts';

/** The generic names no identifier may take alone, and the parameters a function may have. */
const VALUES = {
  deniedIdentifiers: ['common', 'data', 'endpoint', 'handler', 'helpers', 'info', 'item', 'manager', 'misc', 'script'],
  functionParameters: 3,
} as const;

/**
 * What enforces `code-module-structure-and-control-flow`: names, parameters, strict tests, the form and order of
 * functions, and the clock.
 */
export const codeModuleStructureAndControlFlow = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'id-denylist',
      behavior: FixBehavior.BindingNames,
      value: [Severity.Error, ...VALUES.deniedIdentifiers],
      standard: 'NM-06',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'typescript/strict-boolean-expressions',
      value: [
        Severity.Error,
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowNullableEnum: false,
          allowAny: false,
        },
      ],
      standard: 'TD-08',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'typescript/no-unnecessary-condition',
      value: [Severity.Error, { allowConstantLoopConditions: 'only-allowed-literals' }],
      violation: ['export function size(text: string): number { return text === undefined ? 0 : text.length; }'],
      allowed: [
        'export function size(text: string | undefined): number { return text === undefined ? 0 : text.length; }',
      ],
      standard: 'TD-08',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'max-params',
      value: [Severity.Error, { max: VALUES.functionParameters }],
      standard: 'ST-25',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    ...FUNCTION_FORM_RULES,
    {
      ...OXLINT_DEFAULTS,
      name: 'new-cap',
      value: [Severity.Error, { capIsNew: false }],
      standard: '007',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'no-bitwise',
      value: Severity.Error,
      maxSuppressions: 3,
      standard: '007',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message: 'Read the clock once and pass it down, such as `const now = DateTime.nowUnsafe()`',
      properties: { Date: ['now'], DateTime: ['now'] },
      imports: [{ module: 'effect', names: ['Clock'] }],
      exemptRoles: [],
      standard: 'EF-17',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Time,
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'date-constructor',
      standard: 'EF-17',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Time,
      violation: ['const now = new Date();', 'const opened = new Date(openedAtMs);'],
      allowed: ['const now = DateTime.nowUnsafe();'],
    },
  ],
} as const satisfies ContractEnforcement;

import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-typescript-class-declarations`: only runtime and error classes, private fields, no services. */
export const codeTypescriptClassDeclarations = {
  values: {},
  rules: [
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'class-methods-use-this', value: Severity.Error, standard: '020' },
    {
      ...RESTRICTED_DEFAULTS,
      message: 'Pass each dependency in the input object, such as `startStack({ settings })`',
      properties: {
        Effect: ['provide', 'provideContext', 'provideService', 'provideServiceEffect', 'service', 'serviceOption'],
      },
      imports: [{ module: 'effect', names: ['Context', 'Layer', 'LayerMap', 'ManagedRuntime'] }],
      exemptRoles: [],
      standard: 'EF-13',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'class-accessibility-keyword',
      standard: '020',
      violation: ['class Stack { private ready = false; }'],
      allowed: ['class Stack { readonly #ready = false; }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'class-field-form',
      standard: '020',
      violation: ['class Stack { ready = false; }', 'class Stack { readonly ready = false; }'],
      allowed: [
        'class Stack { readonly #ready = false; }',
        "class Gone extends Base { override readonly message = 'gone'; }",
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'owned-class',
      standard: '020',
      violation: ['class Stack {}', 'abstract class Store {}'],
      allowed: [
        'class MechObject extends DurableObject {}',
        "class Missing extends Schema.TaggedError<Missing>()('Missing', {}) {}",
      ],
    },
  ],
} as const satisfies ContractEnforcement;

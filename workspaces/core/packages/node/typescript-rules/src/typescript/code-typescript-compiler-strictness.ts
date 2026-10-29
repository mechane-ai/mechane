import {
  ADOPTED,
  FixBehavior,
  Lane,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  RuleTool,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What a compiler option holds: a fix by hand that restructures. */
const COMPILER_DEFAULTS = { tool: RuleTool.Compiler, fix: RuleFix.Manual, behavior: FixBehavior.Restructure } as const;

/**
 * The base configuration's options besides strictness: its target, module system and checks. Each lane's program adds
 * its runtime's `lib` or `types`.
 */
const VALUES = {
  inferredRecordFactories: [
    'connectionRecords',
    'findingRecords',
    'slackDeliveryProgressRecords',
    'slackDeliveryRecords',
    'slackOriginRecords',
    'slackRecords',
    'sourceGrantRecords',
    'sourceRecords',
    'watchRecords',
    'workspaceRecoveryRecords',
  ],
  compilerOptions: {
    target: 'es2024',
    module: 'nodenext',
    moduleResolution: 'nodenext',
    lib: ['es2024'],
    types: [],
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
  },
  lanePrograms: {
    [Lane.Shared]: { lib: ['es2024', 'dom'] },
    [Lane.Worker]: { types: ['@cloudflare/workers-types', 'node'] },
    [Lane.Node]: { types: ['node'] },
  },
} as const;

/** A strictness option that the base configuration enabled before the standard (TD-10). */
const STRICT = { ...COMPILER_DEFAULTS, standard: 'TD-10', ...ADOPTED } as const;

/** A strictness option that the proof phase enabled once it measured zero (TD-10). */
const PROVEN = { ...STRICT, status: RuleStatus.Enforced, phase: RolloutPhase.Proof } as const;

/** A strictness option that the registry's phase set once it measured zero, most of them to false (TD-10). */
const REGISTERED = { ...STRICT, status: RuleStatus.Enforced, phase: RolloutPhase.Registry } as const;

/** What enforces `code-typescript-compiler-strictness`: every strictness option set, and no `@ts-` directive. */
export const codeTypescriptCompilerStrictness = {
  values: VALUES,
  rules: [
    { ...STRICT, name: 'strict', value: true },
    { ...STRICT, name: 'noUncheckedIndexedAccess', value: true },
    { ...STRICT, name: 'exactOptionalPropertyTypes', value: true },
    { ...STRICT, name: 'erasableSyntaxOnly', value: true },
    { ...STRICT, name: 'noImplicitOverride', value: true },
    { ...STRICT, name: 'verbatimModuleSyntax', value: true },
    { ...STRICT, name: 'noUnusedLocals', value: true },
    { ...STRICT, name: 'noUnusedParameters', value: true },
    { ...STRICT, name: 'noImplicitReturns', value: true },
    { ...STRICT, name: 'noFallthroughCasesInSwitch', value: true },
    { ...STRICT, name: 'noPropertyAccessFromIndexSignature', value: true },
    { ...PROVEN, name: 'isolatedModules', value: true },
    { ...PROVEN, name: 'noUncheckedSideEffectImports', value: true },
    { ...PROVEN, name: 'forceConsistentCasingInFileNames', value: true },
    { ...REGISTERED, name: 'allowUnreachableCode', value: false },
    { ...REGISTERED, name: 'allowUnusedLabels', value: false },
    { ...REGISTERED, name: 'moduleDetection', value: 'force' },
    { ...REGISTERED, name: 'libReplacement', value: false },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'typescript/ban-ts-comment',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': true }],
      standard: 'TD-10',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'typescript/explicit-function-return-type',
      behavior: FixBehavior.TypeOnly,
      value: [
        Severity.Error,
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: false,
          allowedNames: VALUES.inferredRecordFactories,
        },
      ],
      violation: ['export function readCount() { return 1; }'],
      allowed: ['export function watchRecords(input: number) { return { count: (): number => input }; }'],
      standard: 'TD-09',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'typescript/explicit-module-boundary-types',
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { allowedNames: VALUES.inferredRecordFactories }],
      violation: ['export function readCount() { return 1; }'],
      allowed: ['export function watchRecords(input: number) { return { count: (): number => input }; }'],
      standard: 'TD-09',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
  ],
} as const satisfies ContractEnforcement;

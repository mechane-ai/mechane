import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The statements an `if` without `else` that ends a function may hold. */
const VALUES = { trailingIfStatements: 2 } as const;

/** What enforces `code-guard-clauses`: guards that leave early, in a function and in a generator. */
export const codeGuardClauses = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-else-return',
      fix: RuleFix.Oxlint,
      value: [Severity.Error, { allowElseIf: false }],
      standard: 'EF-21',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'no-lonely-if', value: Severity.Error, standard: 'EF-21' },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-negated-condition',
      fix: RuleFix.Oxlint,
      value: Severity.Error,
      standard: 'EF-21',
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'generator-guard',
      standard: 'EF-04',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
      violation: [
        "const read = Effect.fn('read')(function* () { return yield* Effect.fail(new MechNotFound({ mechId })); });",
      ],
      allowed: ["const read = Effect.fn('read')(function* () { return yield* new MechNotFound({ mechId }); });"],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'succeed-in-generator',
      standard: 'EF-04',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
      violation: [
        "const read = Effect.fn('read')(function* () { return yield* Effect.succeed(1); });",
        'const readCount: ReadCount = () => Effect.succeed(1); const count = readCount();',
        "const doubled = Effect.fn('doubled')(function* ({ items }: DoubledInput) { const double: (item: number) => Effect.Effect<number> = (item) => Effect.succeed(item + item); return yield* Effect.forEach(items, double); });",
      ],
      allowed: [
        "const read = Effect.fn('read')(function* () { return 1; });",
        'Effect.catchTags({ MechNotFound: () => Effect.succeed(0) });',
        'export const health: (input: HealthInput) => Effect.Effect<Health> = () => Effect.succeed(HEALTH);',
        'const fallback: (failure: ReadFailure) => Effect.Effect<number> = () => Effect.succeed(0); const count = Effect.catch(readCount(), fallback);',
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'sync-in-generator',
      standard: 'EF-04',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
      violation: [
        "const write = Effect.fn('write')(function* () { yield* Effect.sync(() => print()); });",
        'const writeLine: WriteLine = ({ line }) => Effect.sync(() => print({ line })); lines.forEach(writeLine);',
      ],
      allowed: [
        "const write = Effect.fn('write')(function* () { print(); });",
        'const writeLine: WriteLine = ({ line }) => Effect.sync(() => print({ line })); const WRITERS: Writers = { line: writeLine };',
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'trailing-if',
      standard: 'ST-26',
      violation: ['function check() { if (isReady) { open(); read(); close(); } }'],
      allowed: ['function check() { if (!isReady) { return; } open(); read(); close(); }'],
    },
  ],
} as const satisfies ContractEnforcement;

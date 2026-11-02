import {
  AST_GREP_DEFAULTS,
  FixBehavior,
  OWNED_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleStatus,
} from '@mechane/rule-shapes';

/** A restricted rule of the dialect, which bans no import and exempts no file. */
const RESTRICTED = { ...RESTRICTED_DEFAULTS, imports: [], exemptRoles: [] } as const;

/** The rollout of a rule of the Effect dialect, which its sweep clears (EF-01, EF-02). */
const SWEPT_IN_DIALECT = { status: RuleStatus.Ratchet, phase: RolloutPhase.EffectDialect } as const;

/**
 * The rules of the Effect dialect, EF-01's `Effect.fn` and EF-02's `yield*`, which the standard gives local contract
 * 103; until that contract lands, `code-typescript-effect-errors` holds them.
 */
export const EFFECT_DIALECT_RULES = [
  {
    ...RESTRICTED,
    ...SWEPT_IN_DIALECT,
    message: "Write an effectful function as `Effect.fn`, such as `Effect.fn('startStack')(function* (input) { … })`",
    properties: { Effect: ['gen', 'fnUntraced'] },
    standard: 'EF-01',
  },
  {
    ...RESTRICTED,
    ...SWEPT_IN_DIALECT,
    message: 'Bind each value with `yield*`, such as `const row = yield* readRow(input)`',
    properties: {
      Effect: ['map', 'flatMap', 'andThen', 'tap', 'as', 'asVoid', 'asSome', 'zip', 'zipWith', 'suspend', 'flatten'],
    },
    standard: 'EF-02',
  },
  {
    ...RESTRICTED,
    ...SWEPT_IN_DIALECT,
    message: 'Leave a generator by returning a failure, such as `return yield* new MechNotFound({ mechId })`',
    properties: { Effect: ['filterOrFail'] },
    standard: 'EF-02',
  },
  {
    ...OWNED_DEFAULTS,
    name: 'span-name',
    standard: 'EF-01',
    violation: [{ 'scripts/read-turns.ts': "export const readTurns = Effect.fn('loadTurns')(function* () {});\n" }],
    allowed: [{ 'scripts/read-turns.ts': "export const readTurns = Effect.fn('readTurns')(function* () {});\n" }],
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Baselines,
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'effect-fn-return-type',
    behavior: FixBehavior.TypeOnly,
    standard: 'EF-01',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Baselines,
    violation: ["const start = Effect.fn('start')(function* () { return yield* open(); });"],
    allowed: ["const start = Effect.fn('start')(function* (): Effect.fn.Return<Stack> { return yield* open(); });"],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'effect-function-form',
    standard: 'EF-01',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.EffectDialect,
    violation: ['function start(): Effect.Effect<Stack> { return open(); }'],
    allowed: ["const start = Effect.fn('start')(function* (): Effect.fn.Return<Stack> { return yield* open(); });"],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'effect-import-form',
    standard: 'EF-02',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Baselines,
    violation: ["import * as Effect from 'effect/Effect';", "import { Effect as E } from 'effect';"],
    allowed: ["import { Effect, Option } from 'effect';"],
  },
] as const;

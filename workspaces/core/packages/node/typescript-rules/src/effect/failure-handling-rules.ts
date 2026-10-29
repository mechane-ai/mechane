import { AST_GREP_DEFAULTS, RESTRICTED_DEFAULTS, RolloutPhase, RuleFix, RuleStatus } from '@mechane/rule-shapes';

/** A restricted rule of failure handling, which bans no import and exempts no file. */
const RESTRICTED = { ...RESTRICTED_DEFAULTS, imports: [], exemptRoles: [] } as const;

/**
 * How `code-typescript-effect-errors` handles a failure: never discarded, recovered by its tag, died on only for a
 * broken invariant, and caught whole only at an entry boundary.
 */
export const FAILURE_HANDLING_RULES = [
  {
    ...RESTRICTED,
    message: 'Handle each expected failure by its tag, such as `Effect.catchTags({ MechNotFound: … })`',
    properties: {
      Effect: ['ignore', 'option', 'result', 'either', 'orElse', 'orElseSucceed', 'orElseFail', 'catchCause'],
    },
    standard: 'ER-05',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Proof,
  },
  {
    ...RESTRICTED,
    message: 'Guard with `Option.isNone` and leave, such as `if (Option.isNone(row)) { return … }`',
    properties: { Option: ['getOrThrowWith'] },
    standard: 'ER-06',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'defect-sites',
    standard: 'ER-06',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'const row = Option.getOrThrow(store.mech());',
      'const settings = Schema.decodeUnknownSync(Variables)(environment);',
      'const restored = Effect.orDie(restart());',
      'function work() { const release = (opened) => Effect.orDie(close(opened)); return release(resource); }',
      'function work() { const release = (opened) => Effect.orDie(close(opened)); return Effect.acquireRelease(open(), otherRelease); }',
      'function work() { const release = (opened) => Effect.orDie(close(opened)); function nested(release) { return Effect.acquireRelease(open(), release); } return release(resource); }',
    ],
    allowed: [
      'const name = Option.getOrThrow(Option.fromNullishOr(names[0]));',
      'class MechObject { listThreads(query: unknown) { return Schema.decodeUnknownSync(ThreadsQuery)(query); } }',
      'const file = Effect.acquireRelease(open(), (opened) => Effect.orDie(close(opened)));',
      'function work() { const release = (opened) => Effect.orDie(close(opened)); return Effect.acquireRelease(open(), release); }',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'catch-tags',
    fix: RuleFix.AstGrep,
    standard: 'ER-07',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
    violation: ["run.pipe(Effect.catchTag('MechNotFound', () => missing));"],
    allowed: ['run.pipe(Effect.catchTags({ MechNotFound: () => missing }));'],
    fixed: ['run.pipe(Effect.catchTags({ MechNotFound: () => missing }));'],
  },
  {
    ...RESTRICTED,
    message: 'Recover with the object form of `Effect.catchTags`, such as `Effect.catchTags({ MechNotFound: … })`',
    properties: { Effect: ['catchTag', 'catchIf', 'catchFilter', 'catchSome', 'match'] },
    standard: 'ER-07',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'catch-all-outside-boundary',
    standard: 'ER-08',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      "const read = Effect.fn('read')(function* () { return yield* Effect.catch(readCount(), () => Effect.succeed(0)); });",
      'const answered = route.pipe(Effect.catch((failure) => Effect.succeed(respondFailure({ failure }))));',
    ],
    allowed: [
      "const serve = Effect.fn('serve')(function* () { return yield* route(); }, Effect.catch((failure) => Effect.succeed(respondFailure({ failure }))));",
      "const runCommand = Effect.fn('runCommand')(function* ({ invocation }: RunCommandInput) { return yield* run({ invocation }); }, (run, { invocation }) => Effect.catch(run, (failure) => Effect.succeed(reportFailure({ invocation, failure }))));",
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'no-instanceof',
    standard: 'EF-05',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: ['const isTransient = (failure: unknown) => failure instanceof Unreachable;'],
    allowed: ['const retried = call.pipe(Effect.retry({ while: Match.valueTags({ Unreachable: () => true }) }));'],
  },
] as const;

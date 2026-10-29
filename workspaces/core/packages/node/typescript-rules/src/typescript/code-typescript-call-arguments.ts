import {
  AST_GREP_DEFAULTS,
  InstalledAsset,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { Option } from 'effect';

/**
 * What enforces `code-typescript-call-arguments`: the awaited-member rule of its shipped oxlint file, and a copy of its
 * call-arguments rule that keeps Mechane's schema declarations and SC-02's E6 and E8.
 */
export const codeTypescriptCallArguments = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/no-await-expression-member',
      asset: InstalledAsset.Oxlint,
      value: Severity.Error,
      standard: '064',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'nested-call',
      derivedFrom: Option.some({
        asset: 'assets/ast-grep/rules/call-arguments-typescript.yml',
        hash: 'blake3:48337e75a01fa3342b47ed32370cf72b62d0d890c312d00a47b20272a51c8a4f',
      }),
      standard: '064',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.EffectDialect,
      violation: [
        'send({ invoice: await load({ id }) });',
        'report({ total: Number.sumAll(sizes) });',
        "const main = Effect.fn('main')(function* () { return yield* run(); }, Effect.withSpan(spanName({ name })));",
        'const reason = describe({ text: String(cause) });',
        'const id = TurnId.make(readIdentifier());',
      ],
      allowed: [
        'const total = Number.sumAll(sizes); report({ total });',
        'const id = TurnId.make(crypto.randomUUID());',
        'const id = SandboxOperationId.make(randomUUID());',
        'const totals = orders.map((order) => total({ order }));',
        'const doubled = amount.pipe(map(double), tap(log));',
        'const Row = Schema.Struct({ name: Schema.optional(Schema.String) });',
        'const Parameters = Type.Object({ target: Type.String() });',
        "export class Missing extends Schema.TaggedError<Missing>()('Missing', { path: Schema.optional(Schema.String) }) {}",
        'const read = Effect.tryPromise({ try: () => open(path), catch: (cause) => new Unreadable({ path, reason: String(cause) }) });',
        "const serve = Effect.fn('serve')(function* () { return yield* route(); }, Effect.catch((failure) => Effect.succeed(respondFailure({ failure }))));",
        "const runCommand = Effect.fn('runCommand')(function* () { return yield* run(); }, (run, { invocation }) => Effect.catch(run, (failure) => Effect.succeed(reportFailure({ invocation, failure }))));",
      ],
    },
  ],
} as const satisfies ContractEnforcement;

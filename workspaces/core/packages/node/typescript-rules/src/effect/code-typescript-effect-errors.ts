import { ADOPTED, AST_GREP_DEFAULTS, FileRole, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { EFFECT_DIALECT_RULES } from './effect-dialect-rules.ts';
import { FAILURE_HANDLING_RULES } from './failure-handling-rules.ts';
import { INSTALLED_ERROR_RULES } from './installed-error-rules.ts';

/**
 * What enforces `code-typescript-effect-errors`: the error rules this contract ships, tagged failures, handled by tag,
 * and the Effect dialect's forms until their own contract lands.
 */
export const codeTypescriptEffectErrors = {
  values: {},
  rules: [
    ...INSTALLED_ERROR_RULES,
    ...FAILURE_HANDLING_RULES,
    ...EFFECT_DIALECT_RULES,
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'effect-run-at-entry',
      exemptRoles: [FileRole.WorkerModule],
      standard: 'EF-12',
      violation: ['Effect.runPromise(program);'],
      allowed: ["const read = Effect.fn('read')(function* () { return yield* readRow(input); });"],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'error-free-text',
      standard: 'ER-02',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ["class Missing extends Schema.TaggedError<Missing>()('Missing', { message: Schema.String }) {}"],
      allowed: [
        "class Missing extends Schema.TaggedError<Missing>()('Missing', { mechId: MechId, reason: Schema.String }) {}",
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'no-ok-false',
      standard: 'ER-04',
      violation: ['const answer = { ok: false };'],
      allowed: ['const answer = { ok: true };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'no-throw-or-try',
      standard: 'ER-04',
      violation: ["throw new Error('missing');", 'try { read(); } catch { stop(); }'],
      allowed: ["const read = Effect.fn('read')(function* () { return yield* new FileUnreadable({ path }); });"],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'tagged-error-cause',
      standard: 'ER-01',
      violation: ["class Failed extends Schema.TaggedError<Failed>()('Failed', { cause: Schema.String }) {}"],
      allowed: ["class Failed extends Schema.TaggedError<Failed>()('Failed', { reason: Schema.String }) {}"],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'try-promise-shape',
      standard: 'EF-06',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.EffectDialect,
      violation: [
        'Effect.tryPromise({ try: async () => { await open(); }, catch: (cause) => new Unreadable({ reason: String(cause) }) });',
        'Effect.tryPromise({ try: () => open(), catch: (cause) => String(cause) });',
      ],
      allowed: [
        'Effect.tryPromise({ try: () => open(path), catch: (cause) => new Unreadable({ path, reason: String(cause) }) });',
      ],
    },
  ],
} as const satisfies ContractEnforcement;

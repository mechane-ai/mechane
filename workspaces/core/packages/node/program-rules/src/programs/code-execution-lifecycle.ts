import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { ASYNC_SHELL_RULES } from './async-shell-rules.ts';
import { CONCURRENCY_RULES } from './concurrency-rules.ts';

/** A restricted rule of the Effect dialect that its sweep clears. */
const SWEPT_IN_DIALECT = {
  ...RESTRICTED_DEFAULTS,
  imports: [],
  status: RuleStatus.Ratchet,
  phase: RolloutPhase.EffectDialect,
} as const;

/** The fix of every scope rule, which the celld restart's own scope keeps one exemption from (EF-08). */
const SCOPE_MESSAGE =
  'Own a resource through a scope, such as `Effect.acquireRelease(open, close)` in a scoped `Effect.fn`';

/** What enforces `code-execution-lifecycle`: owned promises, scopes, deadlines, retries and stated concurrency. */
export const codeExecutionLifecycle = {
  values: {},
  rules: [
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'typescript/no-floating-promises', value: Severity.Error, standard: '041' },
    {
      ...OXLINT_DEFAULTS,
      name: 'no-void',
      value: [Severity.Error, { allowAsStatement: true }],
      standard: '041',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...SWEPT_IN_DIALECT,
      message: 'Wrap one call with `Effect.tryPromise`, such as `Effect.tryPromise({ try: () => fetch(url), catch })`',
      properties: { Effect: ['promise'] },
      exemptRoles: [],
      standard: 'EF-06',
    },
    {
      ...SWEPT_IN_DIALECT,
      message: SCOPE_MESSAGE,
      properties: { Effect: ['acquireUseRelease', 'addFinalizer', 'ensuring'], Scope: ['make'] },
      exemptRoles: [],
      standard: 'EF-08',
    },
    {
      ...SWEPT_IN_DIALECT,
      message: SCOPE_MESSAGE,
      properties: { Scope: ['provide'] },
      exemptRoles: [FileRole.CelldRestart],
      standard: 'EF-08',
    },
    {
      ...SWEPT_IN_DIALECT,
      message: SCOPE_MESSAGE,
      properties: { Scope: ['close'] },
      exemptRoles: [],
      standard: 'EF-08',
    },
    {
      ...RESTRICTED_DEFAULTS,
      message:
        'Bound a wait with `Effect.timeoutOrElse` and repeat in a loop, such as `Effect.timeoutOrElse({ duration, orElse })`',
      properties: { Effect: ['timeout', 'timeoutFail', 'repeat'] },
      imports: [],
      exemptRoles: [],
      standard: 'EF-09',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    ...ASYNC_SHELL_RULES,
    {
      ...AST_GREP_DEFAULTS,
      name: 'fetch-signal',
      standard: 'EF-06',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
      violation: [
        'Effect.tryPromise({ try: () => fetch(url), catch: (cause) => new Unreachable({ reason: String(cause) }) });',
      ],
      allowed: [
        'Effect.tryPromise({ try: (signal) => fetch(url, { signal }), catch: (cause) => new Unreachable({ reason: String(cause) }) });',
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'process-signal',
      maxSuppressions: 2,
      standard: 'EF-11',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.EffectDialect,
      violation: ["process.once('SIGINT', stop);"],
      allowed: ['const ended = yield* interruptOnSignal({ program: runMode() });'],
    },
    ...CONCURRENCY_RULES,
  ],
} as const satisfies ContractEnforcement;

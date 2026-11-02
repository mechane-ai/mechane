import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The words that name a numeric limit or duration, whose name must end with a unit or a counted noun. */
const VALUES = {
  measureWords: [
    'timeout',
    'deadline',
    'delay',
    'interval',
    'limit',
    'size',
    'budget',
    'duration',
    'grace',
    'allowance',
    'cap',
    'lifetime',
    'window',
    'ttl',
    'age',
    'period',
    'threshold',
  ],
} as const;

/** What enforces `code-measured-value-names`: the measure words, and the unit and counted-noun word lists. */
export const codeMeasuredValueNames = {
  values: VALUES,
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'measured-value-names',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-08',
      violation: ['const timeout = 30;', 'type Retry = { readonly maxRetry: number };'],
      allowed: ['const timeoutMs = 30;', 'type Retry = { readonly maxAttempts: number };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'bound-order',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-08',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ['const MAX_TURN_SECONDS = 600;'],
      allowed: ['const TURN_MAX_SECONDS = 600;'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'raw-money-number',
      standard: 'TD-15',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: [
        'type Cost = { readonly costMicros: number };',
        'const Cost = Schema.Struct({ costMicros: Schema.Int });',
      ],
      allowed: ['type Cost = { readonly costMicros: Micros };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'raw-time-number',
      standard: 'TD-16',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Time,
      violation: ['type Lifespan = { readonly lifetimeMs: number };', 'type Opened = { readonly expiresAt: number };'],
      allowed: ['type Lifespan = { readonly lifetime: Duration.Duration; readonly expiresAt: DateTime.Utc };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'raw-time-schema',
      standard: 'TD-16',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Time,
      violation: ['const Key = Schema.Struct({ expiresAtMs: Schema.Int });'],
      allowed: ['const Key = wireStruct({ fields: { expiresAt: Schema.DateTimeUtcFromMillis } });'],
    },
  ],
} as const satisfies ContractEnforcement;

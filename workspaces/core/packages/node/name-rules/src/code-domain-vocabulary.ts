import { FixBehavior, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The words that date a name, which no name may hold. */
const VALUES = { historyWords: ['old', 'new', 'legacy', 'deprecated', 'v2', 'temp'] } as const;

/** What enforces `code-domain-vocabulary`: the history words the banned-words ratchet reads. */
export const codeDomainVocabulary = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'banned-words',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-02',
      violation: [{ 'scripts/turns.ts': 'export const legacyTurns = 3;\n' }],
      allowed: [{ 'scripts/turns.ts': 'export const activeTurns = 3;\n' }],
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Names,
    },
  ],
} as const satisfies ContractEnforcement;

import { ADOPTED, FixBehavior, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `ci-reproducible-checks`. */
export const ciReproducibleChecks = {
  values: {},
  rules: [
    { ...OWNED_DEFAULTS, name: 'pins', standard: 'F003', ...ADOPTED },
    {
      ...OWNED_DEFAULTS,
      name: 'orphans',
      behavior: FixBehavior.BindingNames,
      standard: 'F003',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
  ],
} as const satisfies ContractEnforcement;

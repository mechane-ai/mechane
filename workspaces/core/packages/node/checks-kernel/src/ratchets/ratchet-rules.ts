import { RuleStatus } from '@mechane/rule-shapes';
import { findingKey, REGISTERED_RULES } from '@mechane/rules';
import type { Ratchet } from '../types.ts';

/** One rule of the registry. */
type RegisteredRule = (typeof REGISTERED_RULES)[number]['rule'];

/**
 * Every ratchet of the registry, by the key its sites count under. The restricted rules of one standard rule count
 * under that rule, so they are one ratchet.
 */
export function ratchetRules(): ReadonlyArray<Ratchet> {
  const ratchetOf: (rule: RegisteredRule) => Ratchet = (rule) => ({
    rule: findingKey({ rule }),
    tool: rule.tool,
    standard: rule.standard,
    phase: rule.phase,
  });

  const ratchets = REGISTERED_RULES.map(({ rule }) => rule)
    .filter(({ status }) => status === RuleStatus.Ratchet)
    .map(ratchetOf);

  return [...new Map(ratchets.map((ratchet) => [ratchet.rule, ratchet])).values()];
}

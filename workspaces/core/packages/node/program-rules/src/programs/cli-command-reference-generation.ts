import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `cli-command-reference-generation`: a run returns its result, which the output module encodes. */
export const cliCommandReferenceGeneration = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'encode-in-runs',
      standard: 'CP-03',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['const text = Schema.encodeSync(Document)(result);'],
      allowed: ['const run = () => ({ lines, result });'],
    },
  ],
} as const satisfies ContractEnforcement;

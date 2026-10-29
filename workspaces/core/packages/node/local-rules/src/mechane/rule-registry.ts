import { BaselineHold, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * The code no check runs, which only a maintainer's live release verification or an operator's run reaches. It is the
 * egress gateway and its settings, the peer's address and country, the container provider, the deploy program but its
 * render, the release program's commands and the dev server. A sweep whose fix changes field names or restructures
 * leaves them as they are (TS-07).
 */
const VALUES = {
  unexercised: [
    'packages/worker/edge/src/routing/peer.ts',
    'packages/worker/sandbox/src/providers/container-provider.ts',
    'packages/node/deploy-kernel/src/check-refusals.ts',
    'packages/node/deploy-kernel/src/run-git.ts',
    'packages/node/deploy-kernel/src/run-wrangler.ts',
    'packages/node/deploy-kernel/src/temporary-folder.ts',
    'packages/node/deploy-kernel/src/production-variables.ts',
    'packages/node/deploy-preflight/src/**',
    'packages/node/deploy/src/rollout/**',
    'packages/node/deploy-kernel/src/services/**',
    'packages/node/release/src/main.ts',
    'packages/node/release/src/load-release-settings.ts',
    'packages/node/release/src/print-source-release.ts',
    'packages/node/release/src/upload-release.ts',
    'packages/node/release/src/clean-revision.ts',
    'packages/node/release/src/build/build-source-release.ts',
    'packages/node/stack/src/dev/**',
  ],
  /**
   * How the checks hold each ratchet's baseline to the merge base's: each file to its own count. A change that splits
   * files sets the rule's total instead, so a split takes its function's sites to its new file.
   */
  baselineHold: BaselineHold.PerFile,
} as const;

/** What enforces `rule-registry`: the registry's own checks, which `rules:check` runs over every rule. */
export const ruleRegistry = {
  values: VALUES,
  rules: [
    { ...OWNED_DEFAULTS, name: 'rules', standard: 'AS-01', status: RuleStatus.Enforced, phase: RolloutPhase.Registry },
  ],
} as const satisfies ContractEnforcement;

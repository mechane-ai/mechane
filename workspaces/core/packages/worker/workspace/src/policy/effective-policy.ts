import type { WorkspacePolicy } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import type { WorkspaceVariables } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';

type EffectivePolicyInput = {
  readonly store: WorkspaceStore;
  readonly settings: WorkspaceVariables;
  readonly initialAllowanceMicros: typeof Micros.Encoded;
};

/** Installation reductions take effect without replacing the operator's saved workspace policy. */
export function effectivePolicy({ store, settings, initialAllowanceMicros }: EffectivePolicyInput): WorkspacePolicy {
  const defaultPolicy: () => WorkspacePolicy = () => ({
    isSuspended: false,
    hasSandboxes: settings.isWorkspaceSandboxEnabledByDefault,
    machines: settings.workspaceMachines,
    dailyAllowanceMicros: Micros.make(initialAllowanceMicros),
  });

  const stored = store.readPolicy();
  const policy = Option.getOrElse(stored, defaultPolicy);
  const limitedMicros = Math.min(policy.dailyAllowanceMicros, settings.workspaceDailyAllowanceLimitMicros);

  return {
    ...policy,
    hasSandboxes: policy.hasSandboxes && settings.isSandboxEnabled,
    machines: Math.min(policy.machines, settings.workspaceMachines),
    dailyAllowanceMicros: Micros.make(limitedMicros),
  };
}

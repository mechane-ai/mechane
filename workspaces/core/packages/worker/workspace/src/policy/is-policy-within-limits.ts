import type { WorkspacePolicy } from '@mechane/protocol';
import type { WorkspaceVariables } from '@mechane/rpc';

type IsPolicyWithinLimitsInput = { readonly settings: WorkspaceVariables; readonly policy: WorkspacePolicy };

/** A workspace cannot grant more capacity than the installation allows. */
export function isPolicyWithinLimits({ settings, policy }: IsPolicyWithinLimitsInput): boolean {
  if (
    policy.machines > settings.workspaceMachines ||
    policy.dailyAllowanceMicros > settings.workspaceDailyAllowanceLimitMicros
  ) {
    return false;
  }

  return !policy.hasSandboxes || settings.isSandboxEnabled;
}

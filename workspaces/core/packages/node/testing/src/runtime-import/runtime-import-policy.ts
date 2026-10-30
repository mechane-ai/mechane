import { WorkspacePolicy } from '@mechane/protocol';
import { Schema } from 'effect';
import type { SharedWorkspaceFixture } from '../types.ts';

type RuntimeImportPolicyInput = { readonly workspace: SharedWorkspaceFixture; readonly hasSandboxes: boolean };

/** Only sandbox admission varies between the conflicting policy and the successful retry. */
export function runtimeImportPolicy({
  workspace,
  hasSandboxes,
}: RuntimeImportPolicyInput): typeof WorkspacePolicy.Encoded {
  return Schema.encodeSync(WorkspacePolicy)({
    isSuspended: false,
    hasSandboxes,
    machines: 1,
    dailyAllowanceMicros: workspace.created.dailyAllowanceMicros,
  });
}

import type { ControlStore } from '@mechane/control-store';
import { SandboxDisabled } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

type SandboxPolicyInput = { readonly store: ControlStore; readonly workspaceId: string };

export async function requireSandboxEnabled({ store, workspaceId }: SandboxPolicyInput): Promise<void> {
  const policy = await store.showWorkspacePolicy(workspaceId);

  if (!policy.hasSandboxes || policy.isSuspended) {
    throw new SandboxDisabled({ workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId) });
  }
}

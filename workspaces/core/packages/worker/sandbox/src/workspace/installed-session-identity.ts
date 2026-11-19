import { MechId, recordIdFromDigest } from '@mechane/records';
import type { RecordId, WorkspaceId } from '@mechane/records';
import type { InstalledActionOrigin, ManagedWorkerSession, SandboxOwner } from '@mechane/sandbox-wire';
import { createHash } from 'node:crypto';

type InstalledIdentity = typeof ManagedWorkerSession.Type & { readonly workspaceId: WorkspaceId };

type Binding = { readonly name: string; readonly owner: SandboxOwner };

export function installedSessionIdentity({ workspaceId, environmentId, sessionId }: InstalledIdentity): Binding {
  const name = JSON.stringify(['managed-session', workspaceId, environmentId, sessionId]);
  const digest = createHash('sha256').update(name).digest('hex');
  const id = recordIdFromDigest({ digest });
  const owner = { workspaceId, mechId: MechId.make(id) };

  return { name, owner };
}

type OriginMatch = {
  readonly owner: SandboxOwner;
  readonly generation: number;
  readonly actionId: RecordId;
  readonly origin: typeof InstalledActionOrigin.Type;
};

export function installedActionOriginMatches({ owner, generation, actionId, origin }: OriginMatch): boolean {
  const binding = installedSessionIdentity(origin);
  const isOwner = binding.owner.workspaceId === owner.workspaceId && binding.owner.mechId === owner.mechId;

  return isOwner && origin.generation === generation && origin.actionId === actionId;
}

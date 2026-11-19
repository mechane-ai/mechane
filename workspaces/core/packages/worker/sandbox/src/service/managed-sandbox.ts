import { WorkspaceId } from '@mechane/records';
import { ManagedWorkerSession } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { installedSessionIdentity } from '../workspace/installed-session-identity.ts';
import { sandboxStub } from './settings.ts';
import type { SandboxServiceEnvironment } from './settings.ts';

export const InstalledSession = Schema.Struct({ ...ManagedWorkerSession.fields, workspaceId: WorkspaceId });

type BoundSessionInput = {
  readonly session: typeof InstalledSession.Type;
  readonly environment: SandboxServiceEnvironment;
};

export async function boundManagedSandbox({ environment, session }: BoundSessionInput) {
  const { name, owner } = installedSessionIdentity(session);
  const stub = sandboxStub({ environment, name });

  await stub.bindManagedOwner({ owner });

  return { stub, owner };
}

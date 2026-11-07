import type { SandboxEnvironment, SandboxObject } from '@mechane/sandbox';
import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';

export type ServiceEnvironment = SandboxEnvironment & { readonly SANDBOXES: DurableObjectNamespace<SandboxObject> };

type SandboxStubInput = { readonly environment: ServiceEnvironment; readonly identity: SandboxServiceIdentity };

export function sandboxStub({ environment, identity }: SandboxStubInput): DurableObjectStub<SandboxObject> {
  const name = JSON.stringify([identity.workspaceId, identity.mechId]);
  const identifier = environment.SANDBOXES.idFromName(name);

  return environment.SANDBOXES.get(identifier);
}

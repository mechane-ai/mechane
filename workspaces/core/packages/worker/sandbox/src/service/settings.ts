import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import type { SandboxEnvironment } from '../environment.ts';
import type { SandboxObject } from '../sandbox-object.ts';

/** The same sandbox binding can be composed into the application Worker or the local environment entry. */
export type SandboxServiceEnvironment = SandboxEnvironment & {
  readonly SANDBOXES: DurableObjectNamespace<SandboxObject>;
};

type SandboxStubInput = { readonly environment: SandboxServiceEnvironment; readonly identity: SandboxServiceIdentity };

export function sandboxStub({ environment, identity }: SandboxStubInput): DurableObjectStub<SandboxObject> {
  const name = JSON.stringify([identity.workspaceId, identity.mechId]);
  const identifier = environment.SANDBOXES.idFromName(name);

  return environment.SANDBOXES.get(identifier);
}

import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import type { SandboxEnvironment } from '../environment.ts';
import type { SandboxObject } from '../sandbox-object.ts';

/** The same sandbox binding can be composed into the application Worker or the local environment entry. */
export type SandboxServiceEnvironment = SandboxEnvironment & {
  readonly SANDBOXES: DurableObjectNamespace<SandboxObject>;
};

type SandboxStubInput = { readonly environment: SandboxServiceEnvironment } & (
  | { readonly identity: SandboxServiceIdentity }
  | { readonly name: string }
);

export function sandboxStub(input: SandboxStubInput): DurableObjectStub<SandboxObject> {
  if ('name' in input) {
    return input.environment.SANDBOXES.getByName(input.name);
  }

  const { workspaceId, mechId } = input.identity;
  const name = JSON.stringify([workspaceId, mechId]);

  return input.environment.SANDBOXES.getByName(name);
}

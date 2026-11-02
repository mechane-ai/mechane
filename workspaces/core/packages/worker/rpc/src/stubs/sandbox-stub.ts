import { SandboxOwner } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import type { BindingsInput, SandboxRpc } from '../types.ts';
import { sandboxObjectName } from './sandbox-object-name.ts';

type SandboxStubInput = BindingsInput &
  Omit<typeof SandboxOwner.Encoded, 'droneId'> & {
    /** Absent for the mech's own sandbox. */
    readonly droneId: Option.Option<NonNullable<(typeof SandboxOwner.Encoded)['droneId']>>;
  };

type SandboxIdentityInput = BindingsInput & { readonly owner: SandboxOwner };

/** The canonical identity is shared by routing and the object's validation of its trusted owner. */
export function sandboxIdentity({ bindings, owner }: SandboxIdentityInput): DurableObjectId {
  const name = sandboxObjectName(owner);

  return bindings.sandboxes.idFromName(name);
}

/** Binds ownership before the mech reaches its sandbox, including the first call after a runtime upgrade. */
export async function sandboxStub({
  bindings,
  workspaceId,
  mechId,
  droneId,
}: SandboxStubInput): Promise<DurableObjectStub<SandboxRpc>> {
  const encodedDrone = Option.getOrNull(droneId);
  const encoded = { workspaceId, mechId, droneId: encodedDrone };
  const decoded = Schema.decodeUnknownResult(SandboxOwner)(encoded);
  const owner = Result.getOrThrow(decoded);
  const identity = sandboxIdentity({ bindings, owner });
  const stub = bindings.sandboxes.get(identity);

  await stub.bindOwner({ owner: encoded });

  return stub;
}

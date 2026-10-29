import { DurableObjectClass } from '@mechane/protocol';
import { directoryStub } from '@mechane/rpc';
import type { BindingsInput } from '@mechane/rpc';

/**
 * The name of the objects that readiness opens to prove each class migrates. No other object has it: a workspace's name
 * is its UUID, a mech's or a sandbox's holds a slash, a limiter's a colon and a shard's two digits.
 */
const READINESS_NAME = 'readiness';

/** One object readiness opens: its class, and the call that reads its schema revision. */
type ReadinessProbe = { readonly objectClass: DurableObjectClass; readonly schemaRevision: () => Promise<unknown> };

/**
 * The object of each class that readiness opens to prove the class migrates: the one directory, and an object of each
 * other class that readiness alone names. Those hold no workspace, mech, sandbox, address, principal, user or shard.
 */
export function readinessStubs({ bindings }: BindingsInput): ReadonlyArray<ReadinessProbe> {
  const { workspaces, mechs, sandboxes, limiters, keyCaches } = bindings;
  const directory = directoryStub({ bindings });
  const workspace = workspaces.get(workspaces.idFromName(READINESS_NAME));
  const mech = mechs.get(mechs.idFromName(READINESS_NAME));
  const sandbox = sandboxes.get(sandboxes.idFromName(READINESS_NAME));
  const limiter = limiters.get(limiters.idFromName(READINESS_NAME));
  const keyCache = keyCaches.get(keyCaches.idFromName(READINESS_NAME));

  return [
    { objectClass: DurableObjectClass.Directory, schemaRevision: () => directory.schemaRevision() },
    { objectClass: DurableObjectClass.Workspace, schemaRevision: () => workspace.schemaRevision() },
    { objectClass: DurableObjectClass.Mech, schemaRevision: () => mech.schemaRevision() },
    { objectClass: DurableObjectClass.Sandbox, schemaRevision: () => sandbox.schemaRevision() },
    { objectClass: DurableObjectClass.Limiter, schemaRevision: () => limiter.schemaRevision() },
    { objectClass: DurableObjectClass.KeyCache, schemaRevision: () => keyCache.schemaRevision() },
  ];
}

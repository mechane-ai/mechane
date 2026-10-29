import type { RemoteListInput } from '@mechane/harness-tools';
import type { RemoteToolsOutcome } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { describeGrantedConnection } from './describe-granted-connection.ts';
import { listGrantedConnections } from './list-granted-connections.ts';
import { remoteMechIdentity } from './remote-mech-identity.ts';
import type { MechRemoteToolsInput } from './types.ts';

type ListGrantedToolsInput = MechRemoteToolsInput & RemoteListInput;

/** Suspended workspaces cannot discover connection grants or remote schemas. */
export async function listGrantedTools({
  store,
  settings,
  connectionId,
  signal,
}: ListGrantedToolsInput): Promise<RemoteToolsOutcome> {
  const identity = await remoteMechIdentity({ store, settings });

  if (Result.isFailure(identity)) {
    return identity.failure;
  }

  const { workspaceId, mechId } = identity.success;

  if (Option.isSome(connectionId)) {
    return await describeGrantedConnection({ settings, workspaceId, mechId, connectionId: connectionId.value, signal });
  }

  return await listGrantedConnections({ settings, workspaceId, mechId });
}

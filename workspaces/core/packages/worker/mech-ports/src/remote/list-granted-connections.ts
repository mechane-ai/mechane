import { RemoteToolsOutcome } from '@mechane/protocol';
import type { MechId, WorkspaceId } from '@mechane/records';
import { GrantedConnections, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { Result, Schema } from 'effect';

type ListGrantedConnectionsInput = {
  readonly settings: ObjectSettings;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly mechId: typeof MechId.Encoded;
};

/** Lists current granted tool names without exposing remote URL or secret configuration to the model. */
export async function listGrantedConnections({
  settings,
  workspaceId,
  mechId,
}: ListGrantedConnectionsInput): Promise<RemoteToolsOutcome> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const listed = await workspace.grantedConnections({ mechId });
  const decoded = Schema.decodeUnknownResult(GrantedConnections)(listed);

  if (Result.isFailure(decoded)) {
    return RemoteToolsOutcome.cases.Failed.make({ reason: 'The current grants could not be read' });
  }

  const grants = decoded.success;

  const connections = grants.map(({ connection, grant }) => ({
    connectionId: connection.id,
    name: connection.name,
    tools: grant.tools,
  }));

  return RemoteToolsOutcome.cases.Connections.make({ connections });
}

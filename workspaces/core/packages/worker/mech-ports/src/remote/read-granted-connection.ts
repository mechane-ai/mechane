import { RemoteToolsOutcome } from '@mechane/protocol';
import type { ConnectionId, MechId, WorkspaceId } from '@mechane/records';
import { GrantedConnectionReading, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { Result, Schema } from 'effect';

type ReadGrantedConnectionInput = {
  readonly settings: ObjectSettings;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly mechId: typeof MechId.Encoded;
  readonly connectionId: ConnectionId;
};

/** Reads and decodes current Workspace state without caching grant authority. */
export async function readGrantedConnection({
  settings,
  workspaceId,
  mechId,
  connectionId,
}: ReadGrantedConnectionInput): Promise<Result.Result<GrantedConnectionReading, RemoteToolsOutcome>> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const result = await workspace.grantedConnection({ mechId, connectionId });

  const decoded = Schema.decodeUnknownResult(GrantedConnectionReading)(result);

  if (Result.isFailure(decoded)) {
    const failure = RemoteToolsOutcome.cases.Failed.make({ reason: 'The current grant could not be read' });

    return Result.fail(failure);
  }

  return Result.succeed(decoded.success);
}

import { RemoteToolsOutcome } from '@mechane/protocol';
import type { ConnectionId, MechId, WorkspaceId } from '@mechane/records';
import type { ObjectSettings } from '@mechane/rpc';
import { Option, Result } from 'effect';
import { readGrantedConnection } from './read-granted-connection.ts';
import { runGrantedTool } from './run-granted-tool.ts';

type DescribeGrantedConnectionInput = {
  readonly settings: ObjectSettings;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly mechId: typeof MechId.Encoded;
  readonly connectionId: ConnectionId;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
};

/** Reads the current grant before requesting untrusted remote metadata. */
export async function describeGrantedConnection({
  settings,
  workspaceId,
  mechId,
  connectionId,
  signal,
}: DescribeGrantedConnectionInput): Promise<RemoteToolsOutcome> {
  const reading = await readGrantedConnection({ settings, workspaceId, mechId, connectionId });

  if (Result.isFailure(reading)) {
    return reading.failure;
  }

  const granted = reading.success;

  if (Option.isNone(granted)) {
    return RemoteToolsOutcome.cases.Refused.make({ reason: 'This mech has no grant for the connection' });
  }

  const invocation = Option.none();

  return await runGrantedTool({ settings, workspaceId, mechId, granted: granted.value, signal, invocation });
}

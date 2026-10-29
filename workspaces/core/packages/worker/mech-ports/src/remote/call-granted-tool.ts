import type { RemoteCallInput } from '@mechane/harness-tools';
import { RemoteToolsOutcome } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { readGrantedConnection } from './read-granted-connection.ts';
import { remoteMechIdentity } from './remote-mech-identity.ts';
import { runGrantedTool } from './run-granted-tool.ts';
import type { MechRemoteToolsInput } from './types.ts';

type CallGrantedToolInput = MechRemoteToolsInput & RemoteCallInput;

/** Requires the current mech grant before resolving an operator credential. */
export async function callGrantedTool({
  store,
  settings,
  connectionId,
  toolName,
  arguments: argumentsValue,
  signal,
}: CallGrantedToolInput): Promise<RemoteToolsOutcome> {
  const identity = await remoteMechIdentity({ store, settings });

  if (Result.isFailure(identity)) {
    return identity.failure;
  }

  const { workspaceId, mechId } = identity.success;
  const reading = await readGrantedConnection({ settings, workspaceId, mechId, connectionId });

  if (Result.isFailure(reading)) {
    return reading.failure;
  }

  const granted = reading.success;

  if (Option.isNone(granted) || !granted.value.grant.tools.includes(toolName)) {
    return RemoteToolsOutcome.cases.Refused.make({ reason: 'This mech has no grant for the tool' });
  }

  const invocation = Option.some({ toolName, arguments: argumentsValue });

  return await runGrantedTool({ settings, workspaceId, mechId, granted: granted.value, invocation, signal });
}

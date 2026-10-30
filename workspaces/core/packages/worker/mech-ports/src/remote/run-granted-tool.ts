import { runRemoteMcp } from '@mechane/integrations';
import { RemoteToolsOutcome } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { authorizeGrantedTool } from './authorize-granted-tool.ts';
import { readGrantedToken } from './read-granted-token.ts';
import type { RunGrantedToolInput } from './types.ts';

/** Resolves workspace-scoped credentials and requires fresh authority before actual dispatch. */
export async function runGrantedTool({
  settings,
  workspaceId,
  mechId,
  granted,
  invocation,
  signal,
}: RunGrantedToolInput): Promise<RemoteToolsOutcome> {
  const { connection, grant } = granted;

  const resolved = await readGrantedToken({ settings, workspaceId, granted });

  if (Result.isFailure(resolved)) {
    return RemoteToolsOutcome.cases.Refused.make({ reason: 'The connection credential is unavailable' });
  }

  const token = resolved.success;

  if (Option.isSome(connection.secretReference) && Option.isNone(token)) {
    return RemoteToolsOutcome.cases.Refused.make({ reason: 'The connection credential is not configured' });
  }

  const authorize: () => Promise<boolean> = () =>
    authorizeGrantedTool({ settings, workspaceId, mechId, granted, invocation });

  return await runRemoteMcp({ connection, token, tools: grant.tools, invocation, signal, authorize });
}

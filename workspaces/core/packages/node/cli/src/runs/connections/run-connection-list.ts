import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { RemoteConnection } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Lists owner-visible remote URL configuration without resolving credentials. */
export const runConnectionList = Effect.fn('runConnectionList')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'connection list'>): Effect.fn.Return<CommandResult<'connection list'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'connection list'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'listConnections', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  const line: (connection: RemoteConnection) => string = (connection) =>
    `${connection.id} ${connection.name} ${connection.url.href} (${connection.allowedTools.length} tools)`;

  return { lines: result.connections.map(line), result };
});

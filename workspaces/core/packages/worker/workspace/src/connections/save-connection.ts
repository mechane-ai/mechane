import { CONNECTIONS_PER_WORKSPACE } from '@mechane/protocol';
import type { ConnectionConfiguration } from '@mechane/protocol';
import type { ConnectionId } from '@mechane/records';
import { ConnectionMutation } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { DateTime, Option } from 'effect';

type SaveWorkspaceConnectionInput = {
  readonly store: WorkspaceStore;
  readonly connectionId: ConnectionId;
  readonly configuration: ConnectionConfiguration;
  readonly isCreating: boolean;
};

/** Configuration replacement permanently removes disallowed names from existing mech grants. */
export function saveConnection({
  store,
  connectionId,
  configuration,
  isCreating,
}: SaveWorkspaceConnectionInput): ConnectionMutation {
  const previous = store.readConnection({ connectionId });

  if (!isCreating && Option.isNone(previous)) {
    return ConnectionMutation.cases.NotFound.make({});
  }

  if (isCreating && store.listConnections().length >= CONNECTIONS_PER_WORKSPACE) {
    return ConnectionMutation.cases.LimitReached.make({});
  }

  const now = DateTime.nowUnsafe();

  store.saveConnection({ connectionId, configuration, isCreating, now });

  for (const grant of store.listConnectionGrants({ connectionId })) {
    const tools = grant.tools.filter((name) => configuration.allowedTools.includes(name));

    store.grantTools({ ...grant, tools });
  }

  const createdAt = Option.match(previous, { onNone: () => now, onSome: (connection) => connection.createdAt });
  const connection = { ...configuration, id: connectionId, createdAt, updatedAt: now };

  return ConnectionMutation.cases.Saved.make({ connection });
}

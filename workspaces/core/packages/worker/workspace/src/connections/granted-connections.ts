import type { ToolGrant } from '@mechane/protocol';
import type { MechId } from '@mechane/records';
import type { GrantedConnection } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';

type GrantedConnectionsInput = { readonly store: WorkspaceStore; readonly mechId: MechId };

/** Returns only extant connections and intersects each grant with the current allowed names. */
export function grantedConnections({ store, mechId }: GrantedConnectionsInput): ReadonlyArray<GrantedConnection> {
  const permitted: (grant: ToolGrant) => ReadonlyArray<GrantedConnection> = (grant) => {
    const connection = store.readConnection({ connectionId: grant.connectionId });

    if (Option.isNone(connection)) {
      return [];
    }

    const tools = grant.tools.filter((name) => connection.value.allowedTools.includes(name));

    return [{ connection: connection.value, grant: { ...grant, tools } }];
  };

  const grants = store.listToolGrants({ mechId });

  return grants.flatMap(permitted);
}

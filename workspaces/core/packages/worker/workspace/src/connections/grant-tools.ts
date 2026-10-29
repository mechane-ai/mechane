import type { ToolGrant } from '@mechane/protocol';
import { ToolGrantMutation } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';

type GrantWorkspaceToolsInput = { readonly store: WorkspaceStore; readonly grant: ToolGrant };

/** Rejects unknown mechs, missing connections, and names outside the owner's allowed selection. */
export function grantTools({ store, grant }: GrantWorkspaceToolsInput): ToolGrantMutation {
  const connection = store.readConnection(grant);

  if (Option.isNone(connection)) {
    return ToolGrantMutation.cases.ConnectionNotFound.make({});
  }

  const mech = store.connectionMech(grant);

  if (Option.isNone(mech)) {
    return ToolGrantMutation.cases.MechNotFound.make({});
  }

  const isAllowed = grant.tools.every((name) => connection.value.allowedTools.includes(name));

  if (!isAllowed) {
    return ToolGrantMutation.cases.InvalidTools.make({});
  }

  store.grantTools(grant);

  return ToolGrantMutation.cases.Granted.make({ grant });
}

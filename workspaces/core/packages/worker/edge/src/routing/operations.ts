import type { catalog, OperationName } from '@mechane/protocol';
import { listKeys } from '../operations/auth/list-keys.ts';
import { pollDeviceApproval } from '../operations/auth/poll-device-approval.ts';
import { revokeKey } from '../operations/auth/revoke-key.ts';
import { showPrincipal } from '../operations/auth/show-principal.ts';
import { startDeviceApproval } from '../operations/auth/start-device-approval.ts';
import { createConnection } from '../operations/connections/create-connection.ts';
import { deleteConnection } from '../operations/connections/delete-connection.ts';
import { grantTools } from '../operations/connections/grant-tools.ts';
import { listConnections } from '../operations/connections/list-connections.ts';
import { listToolGrants } from '../operations/connections/list-tool-grants.ts';
import { revokeTools } from '../operations/connections/revoke-tools.ts';
import { updateConnection } from '../operations/connections/update-connection.ts';
import { deleteCredential } from '../operations/credentials/delete-credential.ts';
import { listCredentials } from '../operations/credentials/list-credentials.ts';
import { putCredential } from '../operations/credentials/put-credential.ts';
import { cancelDrone } from '../operations/drones/cancel-drone.ts';
import { listDrones } from '../operations/drones/list-drones.ts';
import { showDrone } from '../operations/drones/show-drone.ts';
import { listFindings } from '../operations/findings/list-findings.ts';
import { cancelTurn } from '../operations/mechs/cancel-turn.ts';
import { cloneMech } from '../operations/mechs/clone-mech.ts';
import { createMech } from '../operations/mechs/create-mech.ts';
import { listMechRevisions } from '../operations/mechs/definitions/list-mech-revisions.ts';
import { showMech } from '../operations/mechs/definitions/show-mech.ts';
import { updateMech } from '../operations/mechs/definitions/update-mech.ts';
import { forkMech } from '../operations/mechs/fork-mech.ts';
import { listEvents } from '../operations/mechs/list-events.ts';
import { listMechs } from '../operations/mechs/list-mechs.ts';
import { listMemories } from '../operations/mechs/list-memories.ts';
import { listThreads } from '../operations/mechs/list-threads.ts';
import { manageSandbox } from '../operations/mechs/manage-sandbox.ts';
import { sendInboxItem } from '../operations/mechs/send-inbox-item.ts';
import { showTurn } from '../operations/mechs/show-turn.ts';
import { configureSlackBinding } from '../operations/slack/configure-slack-binding.ts';
import { configureSlackInstallation } from '../operations/slack/configure-slack-installation.ts';
import { deleteSlackInstallation } from '../operations/slack/delete-slack-installation.ts';
import { listSlackBindings } from '../operations/slack/list-slack-bindings.ts';
import { listSlackDeliveries } from '../operations/slack/list-slack-deliveries.ts';
import { listSlackInstallations } from '../operations/slack/list-slack-installations.ts';
import { manageSource } from '../operations/sources/manage-source.ts';
import { showSourceGrant } from '../operations/sources/show-source-grant.ts';
import { health } from '../operations/status/health.ts';
import { readiness } from '../operations/status/readiness.ts';
import { listWatches } from '../operations/watches/list-watches.ts';
import { setWatch } from '../operations/watches/set-watch.ts';
import { updateWatchStatus } from '../operations/watches/update-watch-status.ts';
import { createWorkspace } from '../operations/workspaces/create-workspace.ts';
import { listWorkspaceMembers } from '../operations/workspaces/list-workspace-members.ts';
import { listWorkspaces } from '../operations/workspaces/list-workspaces.ts';
import { setWorkspacePolicy } from '../operations/workspaces/policy/set-workspace-policy.ts';
import { showWorkspacePolicy } from '../operations/workspaces/policy/show-workspace-policy.ts';
import { removeWorkspaceMember } from '../operations/workspaces/remove-workspace-member.ts';
import { setWorkspaceMember } from '../operations/workspaces/set-workspace-member.ts';
import { showAllowance } from '../operations/workspaces/show-allowance.ts';
import type { OperationWork } from './types.ts';

/** The work of each catalog operation, keyed by the operation's name. */
type OperationWorks = { readonly [N in OperationName]: OperationWork<(typeof catalog)[N]> };

/** The work of each catalog operation; an operation without its work, or with another's, fails to compile. */
export const OPERATIONS: Readonly<OperationWorks> = {
  putCredential,
  listCredentials,
  deleteCredential,
  manageSource,
  showSourceGrant,
  configureSlackBinding,
  configureSlackInstallation,
  listSlackInstallations,
  deleteSlackInstallation,
  listSlackBindings,
  listSlackDeliveries,
  setWatch,
  listWatches,
  updateWatchStatus,
  listFindings,
  createConnection,
  updateConnection,
  deleteConnection,
  listConnections,
  grantTools,
  revokeTools,
  listToolGrants,

  manageSandbox,
  health,
  readiness,
  startDeviceApproval,
  pollDeviceApproval,
  showPrincipal,
  listKeys,
  revokeKey,
  listWorkspaces,
  createWorkspace,
  listWorkspaceMembers,
  setWorkspaceMember,
  removeWorkspaceMember,
  createMech,
  cloneMech,
  listMechs,
  listMechRevisions,
  showMech,
  updateMech,
  forkMech,
  sendInboxItem,
  listEvents,
  showTurn,
  cancelTurn,
  listMemories,
  listThreads,
  listDrones,
  showDrone,
  cancelDrone,
  showAllowance,
  showWorkspacePolicy,
  setWorkspacePolicy,
};

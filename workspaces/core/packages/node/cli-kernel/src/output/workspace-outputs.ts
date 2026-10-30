import {
  Allowance,
  IntegrationSecretReference,
  Workspace,
  WorkspaceList,
  WorkspaceMember,
  WorkspaceMemberList,
  WorkspaceMemberRemoval,
  WorkspacePolicy,
} from '@mechane/protocol';
import { SlackConnectionId, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

const WorkspaceImportResult = wireStruct({
  fields: {
    workspaceId: WorkspaceId,
    importedCredentials: Schema.Array(IntegrationSecretReference),
    retainedCredentials: Schema.Array(IntegrationSecretReference),
    slackInstallations: Schema.Array(SlackConnectionId),
    hasPolicy: Schema.Boolean,
  },
});

type WorkspaceImportResult = typeof WorkspaceImportResult.Type;

/** Workspace commands expose runtime metadata, with imports reporting credential references rather than values. */
export const WORKSPACE_OUTPUTS = {
  'workspace import': WorkspaceImportResult,
  'workspace list': WorkspaceList,
  'workspace create': Workspace,
  'workspace members': WorkspaceMemberList,
  'workspace member set': WorkspaceMember,
  'workspace member remove': WorkspaceMemberRemoval,
  'allowance show': Allowance,
  'workspace policy show': WorkspacePolicy,
  'workspace policy set': WorkspacePolicy,
} as const;

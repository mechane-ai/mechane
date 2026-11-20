import {
  Allowance,
  Workspace,
  WorkspaceList,
  WorkspaceMember,
  WorkspaceMemberList,
  WorkspaceMemberRemoval,
  WorkspacePolicy,
} from '@mechane/protocol';

/** Workspace commands expose runtime metadata. */
export const WORKSPACE_OUTPUTS = {
  'workspace list': WorkspaceList,
  'workspace create': Workspace,
  'workspace members': WorkspaceMemberList,
  'workspace member set': WorkspaceMember,
  'workspace member remove': WorkspaceMemberRemoval,
  'allowance show': Allowance,
  'workspace policy show': WorkspacePolicy,
  'workspace policy set': WorkspacePolicy,
} as const;

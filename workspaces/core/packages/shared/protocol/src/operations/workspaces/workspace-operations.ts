import { createWorkspace } from './create-workspace.ts';
import { listWorkspaceMembers } from './list-workspace-members.ts';
import { listWorkspaces } from './list-workspaces.ts';
import { removeWorkspaceMember } from './remove-workspace-member.ts';
import { setWorkspaceMember } from './set-workspace-member.ts';
import { showAllowance } from './show-allowance.ts';

/** Workspace membership listings and shared spending allowance. */
export const WORKSPACE_OPERATIONS = {
  listWorkspaces,
  showAllowance,
  createWorkspace,
  listWorkspaceMembers,
  setWorkspaceMember,
  removeWorkspaceMember,
} as const;

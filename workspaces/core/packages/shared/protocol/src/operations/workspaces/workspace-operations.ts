import { listWorkspaces } from './list-workspaces.ts';
import { showAllowance } from './show-allowance.ts';

/** Workspace membership listings and shared spending allowance. */
export const WORKSPACE_OPERATIONS = { listWorkspaces, showAllowance } as const;

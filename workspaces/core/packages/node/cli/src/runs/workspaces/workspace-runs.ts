import { documentRun } from '../document-run.ts';
import { runAllowanceShow } from './run-allowance-show.ts';
import { runWorkspaceCreate } from './run-workspace-create.ts';
import { runWorkspaceList } from './run-workspace-list.ts';
import { runWorkspaceMemberRemove } from './run-workspace-member-remove.ts';
import { runWorkspaceMemberSet } from './run-workspace-member-set.ts';
import { runWorkspaceMembers } from './run-workspace-members.ts';

/** Workspace commands share the document output lifecycle. */
export const WORKSPACE_RUNS = {
  'workspace list': documentRun({ run: runWorkspaceList }),
  'workspace create': documentRun({ run: runWorkspaceCreate }),
  'workspace members': documentRun({ run: runWorkspaceMembers }),
  'workspace member set': documentRun({ run: runWorkspaceMemberSet }),
  'workspace member remove': documentRun({ run: runWorkspaceMemberRemove }),
  'allowance show': documentRun({ run: runAllowanceShow }),
} as const;

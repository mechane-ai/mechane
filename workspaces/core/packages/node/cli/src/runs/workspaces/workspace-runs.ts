import { documentRun } from '../document-run.ts';
import { runWorkspaceImport } from '../workspace-import/run-workspace-import.ts';
import { runAllowanceShow } from './run-allowance-show.ts';
import { runWorkspaceCreate } from './run-workspace-create.ts';
import { runWorkspaceList } from './run-workspace-list.ts';
import { runWorkspaceMemberRemove } from './run-workspace-member-remove.ts';
import { runWorkspaceMemberSet } from './run-workspace-member-set.ts';
import { runWorkspaceMembers } from './run-workspace-members.ts';
import { runWorkspacePolicySet } from './run-workspace-policy-set.ts';
import { runWorkspacePolicyShow } from './run-workspace-policy-show.ts';

/** Workspace commands share the document output lifecycle. */
export const WORKSPACE_RUNS = {
  'workspace import': documentRun({ run: runWorkspaceImport }),
  'workspace list': documentRun({ run: runWorkspaceList }),
  'workspace create': documentRun({ run: runWorkspaceCreate }),
  'workspace members': documentRun({ run: runWorkspaceMembers }),
  'workspace member set': documentRun({ run: runWorkspaceMemberSet }),
  'workspace member remove': documentRun({ run: runWorkspaceMemberRemove }),
  'allowance show': documentRun({ run: runAllowanceShow }),
  'workspace policy show': documentRun({ run: runWorkspacePolicyShow }),
  'workspace policy set': documentRun({ run: runWorkspacePolicySet }),
} as const;

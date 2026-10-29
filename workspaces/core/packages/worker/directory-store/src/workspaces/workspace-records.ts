import type { RecordsInput } from '@mechane/store';
import type { Option } from 'effect';
import type { PrincipalInput, WorkspaceInput, WorkspaceMembershipInput } from '../inputs.types.ts';
import { findPrincipal } from '../principals/find-principal.ts';
import type { PrincipalRow } from '../schemas.ts';
import { insertSharedWorkspace } from './insert-shared-workspace.ts';
import { managedWorkspace } from './managed-workspace.ts';
import { removeWorkspaceMember } from './remove-workspace-member.ts';
import type { ManagedWorkspaceRow, WorkspaceMemberRow } from './schemas.ts';
import { setWorkspaceMember } from './set-workspace-member.ts';
import type { SetWorkspaceMemberInput, SharedWorkspaceInput } from './types.ts';
import { workspaceMembers } from './workspace-members.ts';

/** The workspace store API follows its implementations without repeating their method declarations. */
export type WorkspaceRecords = ReturnType<typeof workspaceRecords>;

/** These record operations share one SQL owner; callers group authority changes in its transaction. */
export function workspaceRecords({ sql }: RecordsInput) {
  return {
    managedWorkspace: (input: WorkspaceInput): Option.Option<ManagedWorkspaceRow> =>
      managedWorkspace({ sql, ...input }),
    insertSharedWorkspace: (input: SharedWorkspaceInput): void => insertSharedWorkspace({ sql, ...input }),
    workspaceMembers: (input: WorkspaceInput): ReadonlyArray<WorkspaceMemberRow> => workspaceMembers({ sql, ...input }),
    setWorkspaceMember: (input: SetWorkspaceMemberInput): void => setWorkspaceMember({ sql, ...input }),
    removeWorkspaceMember: (input: WorkspaceMembershipInput): void => removeWorkspaceMember({ sql, ...input }),
    findPrincipal: (input: PrincipalInput): Option.Option<PrincipalRow> => findPrincipal({ sql, ...input }),
  };
}

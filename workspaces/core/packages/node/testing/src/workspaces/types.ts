import type { Workspace } from '@mechane/protocol';
import type { PrincipalId, WorkspaceId } from '@mechane/records';
import type { Account, CliRefusal, StackInput } from '../types.ts';

/** A retried shared workspace and its original installation administrator. */
export type SharedWorkspaceFixture = {
  readonly owner: Account;
  readonly ownerPrincipalId: PrincipalId;
  readonly workspaceId: WorkspaceId;
  readonly created: Workspace;
  readonly repeated: Workspace;
  readonly conflict: CliRefusal;
};

/** A later sign-up with its protected personal workspace and an older shared membership. */
export type WorkspaceMemberFixture = {
  readonly account: Account;
  readonly principalId: PrincipalId;
  readonly personalWorkspaceId: WorkspaceId;
};

/** The original owner and a later member whose authority changes in one workspace. */
export type WorkspaceAuthorityInput = StackInput & {
  readonly workspace: SharedWorkspaceFixture;
  readonly member: WorkspaceMemberFixture;
};

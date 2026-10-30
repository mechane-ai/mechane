import type { WorkspaceMember } from '@mechane/protocol';
import {
  bootstrapSharedWorkspace,
  check,
  RefusalCode,
  refuseWorkspacePrivileges,
  registerWorkspaceMember,
  transferWorkspaceOwnership,
  verifyRevokedCredentialAccess,
  verifyWorkspaceMemberAccess,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';

/** Membership removal invalidates a cached key's resource access without revoking its account login. */
export const sharedWorkspacesKeepCurrentAuthority = Effect.fn('sharedWorkspacesKeepCurrentAuthority')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const workspace = yield* bootstrapSharedWorkspace({ stack });
  const member = yield* registerWorkspaceMember({ stack, workspace });
  const authority = { stack, workspace, member };

  yield* verifyWorkspaceMemberAccess({ ...authority, guarantee });

  const refusals = yield* refuseWorkspacePrivileges(authority);
  const { removed, missing, creationRetry, remaining } = yield* transferWorkspaceOwnership(authority);

  yield* verifyRevokedCredentialAccess({ ...authority, guarantee });

  const isMember: (entry: WorkspaceMember) => boolean = ({ principalId }) => principalId === member.principalId;

  const conditions = [
    workspace.created.id === workspace.repeated.id,
    workspace.conflict.code === RefusalCode.WorkspaceCreationConflict,
    refusals.cannotCreate.code === RefusalCode.AdministratorRequired,
    refusals.cannotPromote.code === RefusalCode.WorkspaceOwnerRequired,
    refusals.lastOwner.code === RefusalCode.WorkspaceLastOwner,
    refusals.personal.code === RefusalCode.PersonalWorkspaceProtected,
    removed === RefusalCode.WorkspaceNotFound,
    missing === removed,
    creationRetry === RefusalCode.WorkspaceCreationConflict,
    remaining.members.length === 1,
    remaining.members.some(isMember),
  ];

  const detail = `workspace retries ${workspace.created.id}, ${workspace.repeated.id}; refusals ${workspace.conflict.code}, ${refusals.cannotCreate.code}, ${refusals.cannotPromote.code}, ${refusals.lastOwner.code}, ${refusals.personal.code}; removed/missing ${removed}, ${missing}`;

  yield* stack.restart({ variables: {} });
  yield* check({ name: guarantee, conditions, detail });
});

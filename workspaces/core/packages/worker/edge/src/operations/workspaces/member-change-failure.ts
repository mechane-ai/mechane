import {
  PersonalWorkspaceProtected,
  PrincipalNotFound,
  WorkspaceLastOwner,
  WorkspaceMemberNotFound,
} from '@mechane/protocol';
import type { WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import type { PrincipalId, WorkspaceId } from '@mechane/records';
import { WorkspaceOwnerRefusal } from '@mechane/rpc';
import type { WorkspaceMemberChangeRefusal } from '@mechane/rpc';
import { Match, Schema } from 'effect';
import { memberOwnerFailure } from './member-owner-failure.ts';

type MemberChangeFailureInput = {
  readonly refusal: WorkspaceMemberChangeRefusal;
  readonly workspaceId: WorkspaceId;
  readonly principalId: PrincipalId;
};

/** The caller can distinguish authorization, target and ownership conflicts. */
export type MemberChangeFailure =
  | PersonalWorkspaceProtected
  | PrincipalNotFound
  | WorkspaceLastOwner
  | WorkspaceMemberNotFound
  | WorkspaceNotFound
  | WorkspaceOwnerRequired;

/** Directory refusals retain their distinct client recovery paths. */
export function memberChangeFailure({
  refusal,
  workspaceId,
  principalId,
}: MemberChangeFailureInput): MemberChangeFailure {
  if (Schema.is(WorkspaceOwnerRefusal)(refusal)) {
    return memberOwnerFailure({ refusal, workspaceId });
  }

  return Match.valueTags(refusal, {
    PersonalWorkspace: () => new PersonalWorkspaceProtected({ workspaceId }),
    PrincipalMissing: () => new PrincipalNotFound({ principalId }),
    MemberMissing: () => new WorkspaceMemberNotFound({ principalId }),
    LastOwner: () => new WorkspaceLastOwner({ workspaceId }),
  });
}

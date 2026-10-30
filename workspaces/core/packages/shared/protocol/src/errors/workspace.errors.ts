import { PrincipalId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** A verified identity remains outside this installation’s configured audience. */
export class IdentityNotAdmitted extends Schema.TaggedError<IdentityNotAdmitted>()('IdentityNotAdmitted', {}) {}

/** Shared workspace creation requires the operator’s separate administrator grant. */
export class InstallationAdministratorRequired extends Schema.TaggedError<InstallationAdministratorRequired>()(
  'InstallationAdministratorRequired',
  {},
) {}

/** A creation id already names a different intent or no longer admits its original creator. */
export class WorkspaceCreationConflict extends Schema.TaggedError<WorkspaceCreationConflict>()(
  'WorkspaceCreationConflict',
  { workspaceId: WorkspaceId },
) {}

/** Create-only policy imports never replace later operator changes. */
export class WorkspacePolicyConflict extends Schema.TaggedError<WorkspacePolicyConflict>()('WorkspacePolicyConflict', {
  workspaceId: WorkspaceId,
}) {}

/** Personal ownership is permanent even for installation administrators. */
export class PersonalWorkspaceProtected extends Schema.TaggedError<PersonalWorkspaceProtected>()(
  'PersonalWorkspaceProtected',
  { workspaceId: WorkspaceId },
) {}

/** The admitted workspace has no membership for the requested principal. */
export class WorkspaceMemberNotFound extends Schema.TaggedError<WorkspaceMemberNotFound>()('WorkspaceMemberNotFound', {
  principalId: PrincipalId,
}) {}

/** An owner can add only a principal that already signed in to the installation. */
export class PrincipalNotFound extends Schema.TaggedError<PrincipalNotFound>()('PrincipalNotFound', {
  principalId: PrincipalId,
}) {}

/** Removing or demoting the only owner would strand workspace administration. */
export class WorkspaceLastOwner extends Schema.TaggedError<WorkspaceLastOwner>()('WorkspaceLastOwner', {
  workspaceId: WorkspaceId,
}) {}

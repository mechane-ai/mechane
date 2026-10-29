import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import {
  PersonalWorkspaceProtected,
  PrincipalNotFound,
  WorkspaceLastOwner,
  WorkspaceMemberNotFound,
} from '../../errors/workspace.errors.ts';

/** Membership changes preserve personal ownership and at least one shared owner. */
export const MEMBER_MUTATION_FAILURES = [
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
  PersonalWorkspaceProtected,
  WorkspaceLastOwner,
  PrincipalNotFound,
  WorkspaceMemberNotFound,
] as const;

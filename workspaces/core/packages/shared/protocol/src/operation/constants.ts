import { AUTHENTICATION_FAILURES } from '../errors/authentication-failures.ts';
import {
  RateLimited,
  RequestInvalid,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
  WorkspaceSuspended,
} from '../errors/errors.ts';

/**
 * The router checks access before decoding the operation. Principal operations need a key, and member operations
 * additionally check workspace membership.
 */
export const Access = { Public: 'public', Principal: 'principal', Member: 'member', Owner: 'owner' } as const;

export type Access = (typeof Access)[keyof typeof Access];

const WORKSPACE_FAILURES = [
  ...AUTHENTICATION_FAILURES,
  ServiceUnavailable,
  RateLimited,
  RequestInvalid,
  WorkspaceNotFound,
  WorkspaceSuspended,
] as const;

/** Admission checks live identity and membership before an operation can read or change workspace data. */
export const ACCESS_FAILURES = {
  [Access.Public]: [],
  [Access.Principal]: [...AUTHENTICATION_FAILURES, ServiceUnavailable, RateLimited],
  [Access.Member]: WORKSPACE_FAILURES,
  [Access.Owner]: [...WORKSPACE_FAILURES, WorkspaceOwnerRequired],
} as const;

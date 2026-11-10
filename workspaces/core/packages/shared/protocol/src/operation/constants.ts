import { AUTHENTICATION_FAILURES } from '../errors/authentication-failures.ts';
import {
  RateLimited,
  RequestInvalid,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceSuspended,
} from '../errors/errors.ts';

/**
 * The router checks access before decoding the operation. Principal operations need a key, and member operations
 * additionally check workspace membership. Self operations use only the scoped runtime credential's recipient.
 */
export const Access = { Public: 'public', Principal: 'principal', Member: 'member', Self: 'self' } as const;

export type Access = (typeof Access)[keyof typeof Access];

/** Admission checks live identity and membership before an operation can read or change workspace data. */
export const ACCESS_FAILURES = {
  [Access.Public]: [],
  [Access.Self]: [...AUTHENTICATION_FAILURES, ServiceUnavailable, RequestInvalid],
  [Access.Principal]: [...AUTHENTICATION_FAILURES, ServiceUnavailable, RateLimited],
  [Access.Member]: [
    ...AUTHENTICATION_FAILURES,
    ServiceUnavailable,
    RateLimited,
    RequestInvalid,
    WorkspaceNotFound,
    WorkspaceSuspended,
  ],
} as const;

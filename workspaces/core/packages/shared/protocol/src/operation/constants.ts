import { AUTHENTICATION_FAILURES } from '../errors/authentication-failures.ts';
import {
  RateLimited,
  RequestInvalid,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceSuspended,
} from '../errors/errors.ts';

/**
 * Who may call an operation; the router admits each request by its operation's access before decoding it. A principal
 * operation needs a key, which the router resolves to the principal it acts for. A member operation's path names a
 * workspace, which its key's principal must belong to.
 */
export const Access = { Public: 'public', Principal: 'principal', Member: 'member' } as const;

export type Access = (typeof Access)[keyof typeof Access];

/** Admission checks live identity and membership before an operation can read or change workspace data. */
export const ACCESS_FAILURES = {
  [Access.Public]: [],
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

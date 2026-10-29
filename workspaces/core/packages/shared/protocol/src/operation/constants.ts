import { AUTHENTICATION_FAILURES } from '../errors/authentication-failures.ts';
import {
  ObjectUnavailable,
  RateLimited,
  RequestInvalid,
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

/**
 * The failures each access's admission adds to its operations' own. A principal's key may be refused, the key cache or
 * the limiter may not answer, or the principal may be past its limit. A member's workspace path may also be malformed,
 * name no workspace of the caller's, or name one the operator suspended.
 */
export const ACCESS_FAILURES = {
  [Access.Public]: [],
  [Access.Principal]: [...AUTHENTICATION_FAILURES, ObjectUnavailable, RateLimited],
  [Access.Member]: [
    ...AUTHENTICATION_FAILURES,
    ObjectUnavailable,
    RateLimited,
    RequestInvalid,
    WorkspaceNotFound,
    WorkspaceSuspended,
  ],
} as const;

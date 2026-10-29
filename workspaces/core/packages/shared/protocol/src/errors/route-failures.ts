import { ObjectUnavailable, RateLimited, RequestInvalid, RouteNotFound, WorkerMisconfigured } from './errors.ts';

/**
 * The failures the Worker may answer any request with besides its route's own. The Worker's settings may not decode,
 * the request's address may be past its limit, or the limiter may not answer. No route may serve the request's method
 * and path, or its operation's schemas may refuse its input.
 */
export const ROUTE_FAILURES = [
  WorkerMisconfigured,
  RateLimited,
  ObjectUnavailable,
  RouteNotFound,
  RequestInvalid,
] as const;

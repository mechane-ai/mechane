import { RateLimited, RequestInvalid, RouteNotFound, ServerMisconfigured, ServiceUnavailable } from './errors.ts';

/**
 * The failures the server may answer any request with besides its route's own. The server's settings may not decode,
 * the request's address may be past its limit, or the limiter may not answer. No route may serve the request's method
 * and path, or its operation's schemas may refuse its input.
 */
export const ROUTE_FAILURES = [
  ServerMisconfigured,
  RateLimited,
  ServiceUnavailable,
  RouteNotFound,
  RequestInvalid,
] as const;

import { HttpStatusCode } from '@mechane/records';

/** The families of API errors: each fixes the HTTP status, and a client reads a code it does not know by its family. */
export const ErrorFamily = {
  InvalidRequest: 'invalid_request',
  Unauthenticated: 'unauthenticated',
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  Conflict: 'conflict',
  RateLimited: 'rate_limited',
  Unavailable: 'unavailable',
} as const;

export type ErrorFamily = (typeof ErrorFamily)[keyof typeof ErrorFamily];

/** The HTTP status code each error family answers with. */
export const FAMILY_STATUS: Readonly<Record<ErrorFamily, HttpStatusCode>> = {
  [ErrorFamily.InvalidRequest]: HttpStatusCode.BadRequest,
  [ErrorFamily.Unauthenticated]: HttpStatusCode.Unauthorized,
  [ErrorFamily.Forbidden]: HttpStatusCode.Forbidden,
  [ErrorFamily.NotFound]: HttpStatusCode.NotFound,
  [ErrorFamily.Conflict]: HttpStatusCode.Conflict,
  [ErrorFamily.RateLimited]: HttpStatusCode.TooManyRequests,
  [ErrorFamily.Unavailable]: HttpStatusCode.Unavailable,
};

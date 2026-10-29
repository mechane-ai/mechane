/**
 * The HTTP status codes Mechane sends and reads, named for the code since `Status` names a lifecycle. A status another
 * system answers, which no member bounds, is a measured `Schema.Int`.
 */
export const HttpStatusCode = {
  Ok: 200,
  NoContent: 204,
  MultipleChoices: 300,
  Found: 302,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  TooManyRequests: 429,
  BadGateway: 502,
  Unavailable: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];

/**
 * The HTTP status codes Mechane sends and reads, named for the code since `Status` names a lifecycle. A status another
 * system answers, which no member bounds, is a measured `Schema.Int`.
 */
export const HttpStatusCode = {
  Ok: 200,
  Accepted: 202,
  PartialContent: 206,
  NoContent: 204,
  MultipleChoices: 300,
  Found: 302,
  SeeOther: 303,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  RequestTimedOut: 408,
  Conflict: 409,
  PreconditionFailed: 412,
  RangeNotSatisfiable: 416,
  PayloadTooLarge: 413,
  UnsupportedMediaType: 415,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
  Unavailable: 503,
  GatewayTimedOut: 504,
  Overloaded: 529,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];

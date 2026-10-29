/** The header names Mechane sends and reads, in the lower case `Headers` stores them in. */
export const HttpHeader = {
  Accept: 'accept',
  AcceptEncoding: 'accept-encoding',
  Authorization: 'authorization',
  CacheControl: 'cache-control',
  // Cloudflare's edge names the client's address in it, which no client can set there; celld sets it on no request.
  ConnectingIp: 'cf-connecting-ip',
  ContentLength: 'content-length',
  ContentSecurityPolicy: 'content-security-policy',
  ContentType: 'content-type',
  Cookie: 'cookie',
  ETag: 'etag',
  GitHubApiVersion: 'x-github-api-version',
  Host: 'host',
  Location: 'location',
  Origin: 'origin',
  ProxyAuthorization: 'proxy-authorization',
  ReferrerPolicy: 'referrer-policy',
  Refresh: 'refresh',
  RetryAfter: 'retry-after',
  SetCookie: 'set-cookie',
  UserAgent: 'user-agent',
  WwwAuthenticate: 'www-authenticate',
  XContentTypeOptions: 'x-content-type-options',
  XSessionId: 'x-session-id',
  SlackRequestTimestamp: 'x-slack-request-timestamp',
  SlackSignature: 'x-slack-signature',
} as const;

export type HttpHeader = (typeof HttpHeader)[keyof typeof HttpHeader];

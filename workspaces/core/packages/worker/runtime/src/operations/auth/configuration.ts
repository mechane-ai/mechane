export type AuthenticationIdentity = { readonly provider: 'github'; readonly subject: string };
export type AuthRateLimit = { readonly requests: number; readonly windowSeconds: number };

export type AuthRateLimits = {
  readonly address: AuthRateLimit;
  readonly deviceStart: AuthRateLimit;
  readonly principal: AuthRateLimit;
  readonly codeAttempt: AuthRateLimit;
};

export type AuthenticationConfiguration = {
  readonly origin: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
  readonly githubWebOrigin: string;
  readonly githubApiOrigin: string;
  readonly allowedIdentities: ReadonlyArray<AuthenticationIdentity> | null;
  readonly administrators: ReadonlyArray<AuthenticationIdentity>;
  readonly bootstrapWorkspaceId: string;
  readonly bootstrapWorkspaceName: string;
  readonly dailyCapMicros: number;
  readonly loginKeyLifetimeSeconds: number;
  readonly namedKeyLifetimeSeconds: number;
  readonly rateLimits?: AuthRateLimits;
};

export const BROWSER_SESSION_SECONDS = 3600;
export const SIGN_IN_SECONDS = 600;
export const DEVICE_APPROVAL_SECONDS = 600;
export const DEVICE_POLL_SECONDS = 3;
export const KEY_LIFETIME_MAX_SECONDS = 31_536_000;

export const DEFAULT_AUTH_RATE_LIMITS: Readonly<AuthRateLimits> = {
  address: { requests: 600, windowSeconds: 60 },
  deviceStart: { requests: 10, windowSeconds: 600 },
  principal: { requests: 300, windowSeconds: 60 },
  codeAttempt: { requests: 10, windowSeconds: 600 },
};

/**
 * The deployment's rate limit policies, the keys of `MECHANE_RATE_LIMITS`. They bound every request but health from one
 * address, the device approvals one address starts, an admitted principal's requests, and the codes one GitHub user
 * types on the device page.
 */
export const LimitPolicy = {
  Address: 'address',
  DeviceStart: 'device_start',
  Principal: 'principal',
  CodeAttempt: 'code_attempt',
} as const;

export type LimitPolicy = (typeof LimitPolicy)[keyof typeof LimitPolicy];

/** The variable that names a deployment's origin to every client that reads its environment, such as the CLI. */
export const ORIGIN_VARIABLE = 'MECHANE_ORIGIN';

/**
 * The variables a deployment passes the Worker, keyed by the settings field each one decodes into. The Worker reads its
 * own origin from the variable clients read; the GitHub client secret and the model upstream's key are secrets. Only a
 * local stack stages the host launcher's origin and key.
 */
export const WORKER_VARIABLES = {
  workerRevision: 'MECHANE_WORKER_REVISION',
  origin: ORIGIN_VARIABLE,
  releaseOrigin: 'MECHANE_RELEASE_ORIGIN',
  githubWebOrigin: 'MECHANE_GITHUB_WEB_ORIGIN',
  githubApiOrigin: 'MECHANE_GITHUB_API_ORIGIN',
  githubClientId: 'MECHANE_GITHUB_CLIENT_ID',
  githubClientSecret: 'MECHANE_GITHUB_CLIENT_SECRET',
  localBootstrapSecret: 'MECHANE_LOCAL_BOOTSTRAP_SECRET',
  allowedIdentities: 'MECHANE_ALLOWED_IDENTITIES',
  administratorIdentities: 'MECHANE_ADMINISTRATOR_IDENTITIES',
  dailyAllowanceMicros: 'MECHANE_DAILY_ALLOWANCE_MICROS',
  mechDailyCapMicros: 'MECHANE_MECH_DAILY_CAP_MICROS',
  loginKeyLifetimeSeconds: 'MECHANE_LOGIN_KEY_LIFETIME_SECONDS',
  namedKeyLifetimeSeconds: 'MECHANE_NAMED_KEY_LIFETIME_SECONDS',
  approvalPollIntervalSeconds: 'MECHANE_APPROVAL_POLL_INTERVAL_SECONDS',
  modelUpstream: 'MECHANE_MODEL_UPSTREAM',
  modelApiKey: 'MECHANE_MODEL_API_KEY',
  credentialKeyring: 'MECHANE_CREDENTIAL_KEYRING',
  modelOffers: 'MECHANE_MODEL_OFFERS',
  sandboxProvider: 'MECHANE_SANDBOX_PROVIDER',
  sandboxEgress: 'MECHANE_SANDBOX_EGRESS',
  tensorlakeApiKey: 'MECHANE_TENSORLAKE_API_KEY',
  tensorlakeImage: 'MECHANE_TENSORLAKE_IMAGE',
  workspaceMachines: 'MECHANE_WORKSPACE_MACHINES',
  isSandboxEnabled: 'MECHANE_SANDBOXES_ENABLED',
  isWorkspaceSandboxEnabledByDefault: 'MECHANE_WORKSPACE_SANDBOXES_DEFAULT',
  workspaceDailyAllowanceLimitMicros: 'MECHANE_WORKSPACE_DAILY_ALLOWANCE_LIMIT_MICROS',
  rateLimits: 'MECHANE_RATE_LIMITS',
  alarmWorkSeconds: 'MECHANE_ALARM_WORK_SECONDS',
  hostLauncherOrigin: 'MECHANE_HOST_LAUNCHER_ORIGIN',
  hostLauncherKey: 'MECHANE_HOST_LAUNCHER_KEY',
} as const;

/**
 * Where a deployment's sandboxes run their machines: in local containers through celld with Docker, or as processes of
 * a local stack's host launcher. Those run as the person who started the stack and isolate nothing.
 */
export const LocalSandboxProvider = { Container: 'container', Host: 'host' } as const;
export type LocalSandboxProvider = (typeof LocalSandboxProvider)[keyof typeof LocalSandboxProvider];

/** The sandbox services available to local stacks and the production Worker. */
export const SandboxProvider = { ...LocalSandboxProvider, Tensorlake: 'tensorlake' } as const;

export type SandboxProvider = (typeof SandboxProvider)[keyof typeof SandboxProvider];

/** Cloudflare routes package requests through the gateway; local celld supplies its own network fence. */
export const SandboxEgress = { Gateway: 'gateway', Fence: 'fence' } as const;

export type SandboxEgress = (typeof SandboxEgress)[keyof typeof SandboxEgress];

/** The tokens an offer's rate prices: each rate is written in micro-dollars per million tokens. */
export const RATE_TOKENS = 1_000_000;

/**
 * The most output tokens an offer may give a request. At about four bytes a token of typical text, a reply this long
 * stays far below SQLite's 2 MB row in pi's entry and the mech's event. A token count bounds typical text, not bytes.
 */
export const OUTPUT_MAX_TOKENS = 65_536;

/** The protocols of an origin a credential may go to: TLS to any host, or plain HTTP to this machine alone. */
export const OriginProtocol = { Secure: 'https:', Loopback: 'http:' } as const;

export type OriginProtocol = (typeof OriginProtocol)[keyof typeof OriginProtocol];

/** The hosts of this machine, the only ones a credential may reach over plain HTTP, such as a local stack's. */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

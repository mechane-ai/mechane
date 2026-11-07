/** The origin variable shared by command-line clients and the sandbox service. */
export const ORIGIN_VARIABLE = 'MECHANE_ORIGIN';

/** Sandbox configuration is separate from the Node runtime's application settings. */
export const SANDBOX_VARIABLES = {
  origin: ORIGIN_VARIABLE,
  sandboxProvider: 'MECHANE_SANDBOX_PROVIDER',
  sandboxHosts: 'MECHANE_SANDBOX_HOSTS',
  hostLauncherOrigin: 'MECHANE_HOST_LAUNCHER_ORIGIN',
  hostLauncherKey: 'MECHANE_HOST_LAUNCHER_KEY',
} as const;

/** Production uses Cloudflare Containers; local verification launches the same guest on its host. */
export const SandboxProvider = { Container: 'container', Host: 'host' } as const;

export type SandboxProvider = (typeof SandboxProvider)[keyof typeof SandboxProvider];

/** Credentials require TLS except for explicit loopback development endpoints. */
export const OriginProtocol = { Secure: 'https:', Loopback: 'http:' } as const;

export type OriginProtocol = (typeof OriginProtocol)[keyof typeof OriginProtocol];

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

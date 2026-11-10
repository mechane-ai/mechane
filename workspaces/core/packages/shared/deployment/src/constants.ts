/** The origin variable shared by command-line clients and the sandbox service. */
export const ORIGIN_VARIABLE = 'MECHANE_ORIGIN';

/** Sandbox configuration describes the environment service independently of the application host. */
export const SANDBOX_VARIABLES = {
  origin: ORIGIN_VARIABLE,
  runtimeOrigin: 'MECHANE_RUNTIME_ORIGIN',
  installationHosts: 'MECHANE_INSTALLATION_HOSTS',
  sandboxProvider: 'MECHANE_SANDBOX_PROVIDER',
  containerNetwork: 'MECHANE_SANDBOX_CONTAINER_NETWORK',
  trustedCertificatesPem: 'MECHANE_SANDBOX_TRUSTED_CERTIFICATES_PEM',
  sandboxHosts: 'MECHANE_SANDBOX_HOSTS',
  sandboxTools: 'MECHANE_SANDBOX_TOOLS',
  sandboxWebAccess: 'MECHANE_SANDBOX_WEB_ACCESS',
  isBrowserSandboxDisabled: 'MECHANE_BROWSER_SANDBOX_DISABLED',
  hostLauncherOrigin: 'MECHANE_HOST_LAUNCHER_ORIGIN',
  hostLauncherKey: 'MECHANE_HOST_LAUNCHER_KEY',
} as const;

export const SandboxProvider = { Container: 'container', Host: 'host' } as const;

export type SandboxProvider = (typeof SandboxProvider)[keyof typeof SandboxProvider];

/** Direct networking is an explicit local platform capability, without hosted gateway interception. */
export const SandboxContainerNetwork = { Gateway: 'gateway', Direct: 'direct' } as const;

export type SandboxContainerNetwork = (typeof SandboxContainerNetwork)[keyof typeof SandboxContainerNetwork];

/** Public browsing keeps the gateway's destination checks and network isolation. */
export const SandboxWebAccess = { Packages: 'packages', Public: 'public' } as const;

export type SandboxWebAccess = (typeof SandboxWebAccess)[keyof typeof SandboxWebAccess];

/** Credentials require TLS except for explicit loopback development endpoints. */
export const OriginProtocol = { Secure: 'https:', Loopback: 'http:' } as const;

export type OriginProtocol = (typeof OriginProtocol)[keyof typeof OriginProtocol];

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

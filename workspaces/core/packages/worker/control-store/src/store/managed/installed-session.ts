type EnvironmentIdentity = { readonly workspaceId: string; readonly environmentId: string };
export type InstalledSession = EnvironmentIdentity & { readonly sessionId: string };
export type InstalledAllocation = InstalledSession & { readonly generation: number };

export function isInstalledEnvironment({ workspaceId, environmentId }: EnvironmentIdentity): boolean {
  return environmentId === `env_${workspaceId.replaceAll('-', '').toLowerCase()}`;
}

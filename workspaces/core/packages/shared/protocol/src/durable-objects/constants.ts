/** The Durable Object classes the Worker exports; readiness reports the schema revision of each one. */
export const DurableObjectClass = {
  Directory: 'DirectoryObject',
  Workspace: 'WorkspaceObject',
  Mech: 'MechObject',
  Sandbox: 'SandboxObject',
  Limiter: 'LimiterObject',
  KeyCache: 'KeyCacheObject',
} as const;

export type DurableObjectClass = (typeof DurableObjectClass)[keyof typeof DurableObjectClass];

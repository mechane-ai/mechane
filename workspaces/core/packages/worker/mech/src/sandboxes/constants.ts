/** Whether the owner permits a new sandbox maintenance operation. */
export const SandboxAccess = { Ready: 'ready', Busy: 'busy', Missing: 'missing' } as const;
export type SandboxAccess = (typeof SandboxAccess)[keyof typeof SandboxAccess];

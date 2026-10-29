/** Personal memberships remain attached to their original principal; shared memberships can be managed. */
export const WorkspaceKind = { Personal: 'personal', Shared: 'shared' } as const;
export type WorkspaceKind = (typeof WorkspaceKind)[keyof typeof WorkspaceKind];

/** Whether a workspace belongs to one principal or is shared by members. */
export const WorkspaceKind = { Personal: 'personal', Shared: 'shared' } as const;

/** A principal's role in a workspace; the owner of a personal workspace is its only member. */
export const MembershipRole = { Owner: 'owner', Member: 'member' } as const;

export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

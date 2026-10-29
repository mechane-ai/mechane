/** A principal's role in a workspace; the owner of a personal workspace is its only member. */
export const MembershipRole = { Owner: 'owner', Member: 'member' } as const;

export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

/** A UTC day as the allowance's account names it, such as `2026-10-23`. */
export const UTC_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

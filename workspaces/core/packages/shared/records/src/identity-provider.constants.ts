/** The authority that issued an identity's subject, separating GitHub users from the local owner. */
export const IdentityProvider = { GitHub: 'github', Local: 'local' } as const;

export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];

/** The loopback bootstrap's stable identity, independent of its display name. */
export const LOCAL_OWNER_IDENTITY = {
  provider: IdentityProvider.Local,
  subject: 'owner',
  name: 'Local owner',
} as const;

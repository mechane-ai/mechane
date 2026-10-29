/** The authority that issued an identity's subject, separating GitHub users from the local owner. */
export const IdentityProvider = { GitHub: 'github', Local: 'local' } as const;

export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];

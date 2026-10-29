import type { IdentitySubject, IdentitySubjects } from './identity-policy.schemas.ts';

type IsIdentityListedInput = { readonly identity: IdentitySubject; readonly identities: IdentitySubjects };

/** Names and email addresses never establish installation admission or administration authority. */
export function isIdentityListed({ identity, identities }: IsIdentityListedInput): boolean {
  return identities.some((entry) => entry.provider === identity.provider && entry.subject === identity.subject);
}

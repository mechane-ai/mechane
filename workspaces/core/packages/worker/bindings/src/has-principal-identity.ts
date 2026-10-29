import { IdentitySubjects, isIdentityListed } from '@mechane/deployment';
import type { ObjectUnavailable } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import { Effect } from 'effect';
import { callDirectory } from './call-directory.ts';
import type { WorkerSettings } from './types.ts';

type HasPrincipalIdentityInput = {
  readonly settings: WorkerSettings;
  readonly principalId: typeof PrincipalId.Encoded;
  readonly identities: IdentitySubjects;
};

/** Authorization reads current identities independently of the cached key's validity. */
export const hasPrincipalIdentity = Effect.fn('hasPrincipalIdentity')(function* ({
  settings,
  principalId,
  identities,
}: HasPrincipalIdentityInput): Effect.fn.Return<boolean, ObjectUnavailable> {
  const ownedIdentities = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.principalIdentities({ principalId }),
    answer: IdentitySubjects,
  });

  return ownedIdentities.some((identity) => isIdentityListed({ identity, identities }));
});

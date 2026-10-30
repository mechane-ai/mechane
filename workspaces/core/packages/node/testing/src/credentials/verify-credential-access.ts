import { Effect } from 'effect';
import { verifyImportPolicyAdmission } from '../runtime-import/verify-import-policy-admission.ts';
import type { ScenarioFailure } from '../types.ts';
import { checkCredentialRefusals } from './check-credential-refusals.ts';
import { checkCredentialRoundtrip } from './check-credential-roundtrip.ts';
import { refuseCredentialPayload } from './refuse-credential-payload.ts';
import type { CredentialScenarioInput } from './types.ts';

/** Import admission and decoder failures must not bypass the owner's credential boundary. */
export const verifyCredentialAccess = Effect.fn('verifyCredentialAccess')(function* ({
  ...input
}: CredentialScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  yield* checkCredentialRoundtrip(input);
  yield* checkCredentialRefusals(input);
  yield* verifyImportPolicyAdmission(input);
  yield* refuseCredentialPayload({
    ...input,
    account: input.workspace.owner,
    workspaceId: input.workspace.workspaceId,
  });
});

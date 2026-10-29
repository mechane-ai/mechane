import type { WorkerSettings } from '@mechane/bindings';
import { isIdentityListed } from '@mechane/deployment';
import type { BrowserIdentity } from '@mechane/records';
import { Effect, Option } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';

type RequireIdentityAdmissionInput = { readonly settings: WorkerSettings; readonly identity: BrowserIdentity };

/** A retained browser session cannot approve another key after its identity loses admission. */
export const requireIdentityAdmission = Effect.fn('requireIdentityAdmission')(function* ({
  settings,
  identity,
}: RequireIdentityAdmissionInput): Effect.fn.Return<void, PageRefused> {
  if (Option.isNone(settings.allowedIdentities)) {
    return;
  }

  if (!isIdentityListed({ identity, identities: settings.allowedIdentities.value })) {
    return yield* new PageRefused({ refusal: PageRefusal.IdentityNotAdmitted });
  }
});

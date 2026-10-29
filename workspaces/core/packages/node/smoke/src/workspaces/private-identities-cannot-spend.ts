import { HttpStatusCode } from '@mechane/records';
import { check, preparePrivateAdmission, RefusalCode, refusePrivateAdmission } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';

/** Removing admission blocks both an existing key and an existing browser session before another model request. */
export const privateIdentitiesCannotSpend = Effect.fn('privateIdentitiesCannotSpend')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const subject = yield* preparePrivateAdmission({ stack });
  const before = stack.modelUpstream.requests().length;

  yield* stack.restart({ variables: { allowedIdentities: '[]' } });

  const refused = yield* refusePrivateAdmission({ stack, subject });
  const after = stack.modelUpstream.requests().length;

  const conditions = [
    refused.approvalStatus === HttpStatusCode.Forbidden,
    refused.signInStatus === HttpStatusCode.Forbidden,
    refused.cliCode === RefusalCode.IdentityNotAdmitted,
    refused.memberCode === RefusalCode.IdentityNotAdmitted,
    after === before,
  ];

  const detail = `retained browser status ${refused.approvalStatus}; new sign-in ${refused.signInStatus}; key refusals ${refused.cliCode}, ${refused.memberCode}; upstream requests ${before} then ${after}`;

  yield* stack.restart({ variables: {} });
  yield* check({ name: guarantee, conditions, detail });
}, Effect.scoped);

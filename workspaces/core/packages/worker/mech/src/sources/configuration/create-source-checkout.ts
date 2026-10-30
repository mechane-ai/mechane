import type { MechTables, SourceTask } from '@mechane/mech-store';
import { SourceAction, SourceStatus } from '@mechane/protocol';
import type { SourceGrant, SourceRequest } from '@mechane/protocol';
import { SourceId } from '@mechane/records';
import type { PrincipalId } from '@mechane/records';
import { SourceAnswer } from '@mechane/rpc';
import { DateTime, Option } from 'effect';
import { checkoutSource } from '../checkout/checkout-source.ts';
import type { SourceManagement } from './types.ts';

type CheckoutAction = { readonly action: typeof SourceAction.Checkout };
type CheckoutRequest = Extract<SourceRequest, CheckoutAction>;

type InitialSourceTaskInput = {
  readonly request: CheckoutRequest;
  readonly grant: SourceGrant;
  readonly principalId: PrincipalId;
};

/** Records the grant and immutable base before any checkout can expose a credential. */
export async function createSourceCheckout({
  mech,
  owner,
  sandbox,
  request,
  principalId,
}: SourceManagement): Promise<SourceAnswer> {
  if (request.action !== SourceAction.Checkout) {
    return SourceAnswer.cases.Refused.make({ reason: 'source checkout does not exist' });
  }

  const read: (store: MechTables) => Option.Option<SourceGrant> = (store) => store.sourceGrant();
  const grant = await mech.store.atomic({ run: read });

  if (Option.isNone(grant)) {
    return SourceAnswer.cases.Refused.make({ reason: 'mech has no repository grant' });
  }

  const source = initialSourceTask({ request, grant: grant.value, principalId });
  const save: (store: MechTables) => void = (store) => store.saveSourceTask({ source });

  await mech.store.atomic({ run: save });

  return await checkoutSource({ mech, owner, sandbox, source });
}

function initialSourceTask({ request, grant, principalId }: InitialSourceTaskInput): SourceTask {
  const generation = SourceId.make(crypto.randomUUID());

  return {
    sourceId: request.sourceId,
    generation,
    grant,
    commit: request.commit,
    status: SourceStatus.Preparing,
    creatorId: principalId,
    createdAt: DateTime.nowUnsafe(),
    publication: Option.none(),
    reason: Option.none(),
  };
}

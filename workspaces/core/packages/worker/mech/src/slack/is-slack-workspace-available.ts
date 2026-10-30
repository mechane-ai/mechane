import { readWorkspacePolicy } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';
import { blockSlackDelivery } from './block-slack-delivery.ts';
import { deferSlackLookup } from './defer-slack-lookup.ts';
import type { RunSlackDeliveryInput } from './types.ts';

/** A policy lookup outage retries delivery; an explicit suspension blocks it. */
export async function isSlackWorkspaceAvailable({
  store,
  settings,
  mech,
  delivery,
}: RunSlackDeliveryInput): Promise<boolean> {
  const promise = readWorkspacePolicy({ bindings: settings, workspaceId: mech.workspaceId });
  const policy = await capturePromise({ promise });

  if (Result.isFailure(policy)) {
    await deferSlackLookup({ store, delivery, reason: 'policy_unavailable' });

    return false;
  }

  if (policy.success.isSuspended) {
    await blockSlackDelivery({ store, delivery, reason: 'workspace_suspended' });

    return false;
  }

  return true;
}

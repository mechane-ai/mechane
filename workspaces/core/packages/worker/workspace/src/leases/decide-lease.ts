import { LeaseDecision } from '@mechane/rpc';
import type { LeaseMachineInput } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';
import type { DateTime } from 'effect';

/** A sandbox's lease to decide, which lasts until `expiresAt`, once its machine's idle window and stop have ended. */
type DecideLeaseInput = {
  readonly store: WorkspaceStore;
  readonly sandboxId: LeaseMachineInput['sandboxId'];
  readonly machines: LeaseMachineInput['machines'];
  readonly expiresAt: DateTime.Utc;
  readonly now: DateTime.Utc;
};

/**
 * Leases a machine to one of the workspace's sandboxes until `expiresAt`, in one transaction. A sandbox that holds a
 * lease renews it, and another gets one only while fewer than `machines` leases are unexpired. A lease outlives a lost
 * release only until it expires, as its machine's own idle stop does.
 */
export function decideLease({
  store,
  sandboxId,
  machines,
  expiresAt,
  now,
}: DecideLeaseInput): typeof LeaseDecision.Encoded {
  const lease: () => typeof LeaseDecision.Encoded = () => {
    store.dropExpiredLeases({ now });

    if (Option.isNone(store.sandboxLease({ sandboxId })) && store.leaseCount() >= machines) {
      return LeaseDecision.cases.Full.make({});
    }

    store.holdLease({ sandboxId, expiresAt });

    return LeaseDecision.cases.Leased.make({});
  };

  return store.atomic({ run: lease });
}

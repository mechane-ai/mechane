import { LeaseDecision } from '@mechane/rpc';
import type { LeaseMachineInput, WorkspaceVariables } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { effectivePolicy } from '../policy/effective-policy.ts';

/** A sandbox's lease to decide, which lasts until `expiresAt`, once its machine's idle window and stop have ended. */
type DecideLeaseInput = {
  readonly store: WorkspaceStore;
  readonly settings: WorkspaceVariables;
  readonly sandboxId: LeaseMachineInput['sandboxId'];
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
  settings,
  sandboxId,
  expiresAt,
  now,
}: DecideLeaseInput): typeof LeaseDecision.Encoded {
  const lease: () => typeof LeaseDecision.Encoded = () => {
    const policy = effectivePolicy({ store, settings, initialAllowanceMicros: 0 });

    if (policy.isSuspended || !policy.hasSandboxes) {
      return LeaseDecision.cases.Disabled.make({});
    }

    store.dropExpiredLeases({ now });

    const leasedMachines = store.leaseCount();

    if (leasedMachines > policy.machines) {
      return LeaseDecision.cases.Full.make({});
    }

    if (Option.isNone(store.sandboxLease({ sandboxId })) && leasedMachines >= policy.machines) {
      return LeaseDecision.cases.Full.make({});
    }

    store.holdLease({ sandboxId, expiresAt });

    return LeaseDecision.cases.Leased.make({});
  };

  return store.atomic({ run: lease });
}

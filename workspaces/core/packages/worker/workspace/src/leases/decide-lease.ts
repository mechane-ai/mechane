import { LeaseDecision } from '@mechane/rpc';
import type { ReserveMachineInput, WorkspaceVariables } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { effectivePolicy } from '../policy/effective-policy.ts';

type DecideLeaseInput = ReserveMachineInput & {
  readonly store: WorkspaceStore;
  readonly settings: WorkspaceVariables;
  readonly now: DateTime.Utc;
};

/** Admission and recording share one transaction. Persistent reservations never expire while files need recovery. */
export function decideLease({
  store,
  settings,
  sandboxId,
  reservationId,
  isAdopting,
  now,
}: DecideLeaseInput): typeof LeaseDecision.Encoded {
  const lease: () => typeof LeaseDecision.Encoded = () => {
    const policy = effectivePolicy({ store, settings, initialAllowanceMicros: 0 });

    store.dropExpiredLeases({ now });

    const held = store.sandboxLease({ sandboxId });

    if (Option.isSome(held) && Option.isSome(held.value.reservationId)) {
      const previous = held.value.reservationId.value;
      const isRetired = reservationId === previous && held.value.active === 0;
      const isSupersedingLive = reservationId > previous && held.value.active === 1;

      if (reservationId < previous || isRetired || isSupersedingLive) {
        return LeaseDecision.cases.Full.make({});
      }
    }

    if (!isAdopting) {
      if (policy.isSuspended || !policy.hasSandboxes) {
        return LeaseDecision.cases.Disabled.make({});
      }

      const count = store.leaseCount();

      const alreadyCounted = Option.exists(held, (record) => record.active === 1);

      if (count > policy.machines || (!alreadyCounted && count >= policy.machines)) {
        return LeaseDecision.cases.Full.make({});
      }
    }

    store.holdLease({ sandboxId, reservationId, now });

    return LeaseDecision.cases.Leased.make({});
  };

  return store.atomic({ run: lease });
}

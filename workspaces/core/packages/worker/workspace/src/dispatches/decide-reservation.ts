import { DispatchStatus } from '@mechane/protocol';
import { ReservationDecision } from '@mechane/rpc';
import type { ReserveDispatchInput } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { DateTime } from 'effect';

/** A dispatch to reserve against its workspace's allowance and its mech's cap, at the call's instant. */
type DecideReservationInput = {
  readonly store: WorkspaceStore;
  readonly dispatch: ReserveDispatchInput['dispatch'];
  readonly allowanceMicros: ReserveDispatchInput['allowanceMicros'];
  readonly capMicros: ReserveDispatchInput['capMicros'];
  readonly now: DateTime.Utc;
};

/**
 * Decides a dispatch against its UTC day, in one transaction. It is reserved when the day's spend and its reservation
 * fit the workspace's allowance and its mech's share fits the mech's cap, and refused otherwise. Either is recorded, so
 * the trace shows a refusal too.
 */
export function decideReservation({
  store,
  dispatch,
  allowanceMicros,
  capMicros,
  now,
}: DecideReservationInput): typeof ReservationDecision.Encoded {
  const day = DateTime.formatIsoDateUtc(now);

  const reserve: () => typeof ReservationDecision.Encoded = () => {
    const { workspaceMicros, mechMicros } = store.committedMicros({ day, mechId: dispatch.mechId });

    if (
      workspaceMicros + dispatch.requestedMicros > allowanceMicros ||
      mechMicros + dispatch.requestedMicros > capMicros
    ) {
      store.recordDispatch({ dispatch: { ...dispatch, day, status: DispatchStatus.Refused, decidedAt: now } });

      return ReservationDecision.cases.Refused.make({});
    }

    store.recordDispatch({ dispatch: { ...dispatch, day, status: DispatchStatus.Reserved, decidedAt: now } });

    return ReservationDecision.cases.Granted.make({});
  };

  return store.atomic({ run: reserve });
}

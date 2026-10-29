import type { MechTables } from '@mechane/mech-store';
import { Delivery, DroneStatus, EventType } from '@mechane/protocol';
import type { DroneId } from '@mechane/records';
import { Match, Option } from 'effect';
import type { DateTime } from 'effect';
import { reportedDrone } from './reported-drone.ts';
import type { DroneEnding } from './schemas.ts';
import type { DroneReport, DroneReportInput } from './types.ts';

/** A running drone to end, how, and when; a drone that ended before stays as it ended. */
type EndDroneInput = {
  readonly store: MechTables;
  readonly droneId: DroneId;
  readonly ending: DroneEnding;
  readonly now: DateTime.Utc;
};

/** A drone that ended without a report, and why. */
type DroneUnreported = typeof DroneEnding.cases.Unreported.Type;

/**
 * Ends a running drone in the caller's transaction and records its report item, with the drone's event. The item takes
 * the id the drone reserved at its start and reaches its mech once it is idle, as any item does, sent by the drone.
 * Only a running drone ends, so a drone that pi's commit and a catch-up both report ends once, with one report.
 */
export function endDrone({ store, droneId, ending, now }: EndDroneInput): void {
  const end = Match.valueTags(ending, {
    Reported: () => ({ status: DroneStatus.Reported }),
    Unreported: ({ reason }) => ({ status: DroneStatus.Unreported, reason }),
  });

  const ended = store.endDrone({ droneId, end, now });

  if (Option.isNone(ended)) {
    return;
  }

  const { threadId, reportInboxItemId } = ended.value;
  const { text, event } = droneReport({ droneId, threadId, reportInboxItemId, ending });
  const receivedSequence = store.appendEvent({ event, now });

  store.receiveInboxItem({
    inboxItem: {
      id: reportInboxItemId,
      text,
      delivery: Delivery.WhenIdle,
      senderId: droneId,
      receivedAt: now,
      receivedSequence,
    },
  });
}

/** What a drone's end tells its mech, and the event that reports it: its final reply, or why it ended without one. */
function droneReport({ droneId, threadId, reportInboxItemId, ending }: DroneReportInput): DroneReport {
  const unreported: (ended: DroneUnreported) => DroneReport = ({ reason }) => ({
    text: `Drone ${droneId} on thread ${threadId} ended without a report: ${reason}.`,
    event: { type: EventType.DroneUnreported, droneId, inboxItemId: reportInboxItemId, reason },
  });

  return Match.valueTags(ending, {
    Reported: ({ report }) => reportedDrone({ droneId, threadId, reportInboxItemId, report }),
    Unreported: unreported,
  });
}

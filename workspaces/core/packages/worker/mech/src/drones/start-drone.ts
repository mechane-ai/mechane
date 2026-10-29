import type { MechTables } from '@mechane/mech-store';
import { UnansweredReason } from '@mechane/protocol';
import { DateTime } from 'effect';
import type { DroneLaunch, OpenedMech } from '../types.ts';
import { endDrone } from './end-drone.ts';
import { DroneEnding } from './schemas.ts';

/** The open mech, and the running drone whose brief pi lacks. */
type StartDroneInput = { readonly mech: OpenedMech; readonly launch: DroneLaunch };

/**
 * Starts a running drone whose brief pi lacks, in the alarm's event: opens its conversation, binds its session id to
 * the drone before its first request, and submits its brief. Each step is keyed, by the drone's document, its unbound
 * session and the brief's request id, so a start a reset cut off is started again whole. A drone canceled before its
 * start ends at once, without its conversation.
 */
export async function startDrone({ mech, launch }: StartDroneInput): Promise<void> {
  const { droneId, brief, modelId, isCanceled } = launch;

  if (isCanceled) {
    const ending = DroneEnding.cases.Unreported.make({ reason: UnansweredReason.Canceled });
    const now = DateTime.nowUnsafe();
    const end: (tables: MechTables) => void = (tables) => endDrone({ store: tables, droneId, ending, now });

    await mech.store.atomic({ run: end });
    mech.signal.wake();

    return;
  }

  const sessionId = await mech.harness.openDrone({ droneId, modelId });

  await mech.store.atomic({ run: (tables) => tables.bindDrone({ droneId, sessionId }) });
  await mech.harness.deliverBrief({ droneId, brief });
}

import type { MechTables } from '@mechane/mech-store';
import { DateTime } from 'effect';
import { projectMechIndex } from '../definitions/project-mech-index.ts';
import { startDrone } from '../drones/start-drone.ts';
import { stopDrone } from '../drones/stop-drone.ts';
import type { OpenedMech } from '../types.ts';
import { cancelTurnCommands } from './cancel-turn-commands.ts';
import type { CaughtUp } from './types.ts';

/** The open mech, and what the alarm owes it. */
type ApplyCatchUpInput = { readonly mech: OpenedMech; readonly caught: CaughtUp };

/**
 * Applies what the alarm owes pi, closing every owed turn first. A note restarts the queue its run left, so it follows
 * that run's end and precedes the items received with it, such as the interrupt that canceled the turn. Canceled drones
 * are aborted before any delivery or start, so a cancel never waits behind another drone's work, and the machines of
 * ended drones stop last.
 */
export async function applyCatchUp({ mech, caught }: ApplyCatchUpInput): Promise<void> {
  await projectMechIndex(mech);

  for (const note of caught.notes) {
    await mech.harness.close(note);
    await cancelTurnCommands({ mech });

    const now = DateTime.nowUnsafe();
    const noteTurn: (tables: MechTables) => void = (tables) => tables.noteTurn({ turnId: note.turnId, now });

    await mech.store.atomic({ run: noteTurn });
  }

  for (const droneId of caught.aborts) {
    await mech.harness.abortDrone({ droneId });
  }

  for (const delivery of caught.deliveries) {
    await mech.harness.deliver(delivery);
  }

  for (const launch of caught.starts) {
    await startDrone({ mech, launch });
  }

  for (const droneId of caught.stops) {
    await stopDrone({ mech, droneId });
  }
}

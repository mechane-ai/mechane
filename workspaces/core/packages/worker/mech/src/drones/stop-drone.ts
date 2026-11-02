import type { MechTables } from '@mechane/mech-store';
import { sandboxStub } from '@mechane/rpc';
import { DateTime, Option } from 'effect';
import type { OpenedMech } from '../types.ts';

/** The open mech, and the ended drone whose machine to stop. */
type StopDroneInput = { readonly mech: OpenedMech; readonly droneId: string };

/**
 * Asks an ended drone's sandbox to stop its machine, in the alarm's event. Only then does it record the request, so a
 * request a reset cut off is asked again. The sandbox owns capacity release after its alarm makes the stop, and retries
 * one that fails.
 */
export async function stopDrone({ mech, droneId }: StopDroneInput): Promise<void> {
  // A drone ends only in a created mech, so the mech's record is there.
  const { workspaceId, id } = Option.getOrThrow(await mech.store.atomic({ run: (tables) => tables.mech() }));

  const sandbox = await sandboxStub({
    bindings: mech.settings,
    workspaceId,
    mechId: id,
    droneId: Option.some(droneId),
  });

  await sandbox.cancelActiveExecutions();
  await sandbox.stop();

  const now = DateTime.nowUnsafe();
  const stop: (tables: MechTables) => void = (tables) => tables.stopDrone({ droneId, now });

  await mech.store.atomic({ run: stop });
}

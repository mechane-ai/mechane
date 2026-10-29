import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import { endGuestProcess } from '../../processes/end-guest-process.ts';
import { fenceSandbox } from '../fence-sandbox.ts';
import { readySandboxOrigin } from '../ready-sandbox-origin.ts';
import type { MaintenanceInput } from '../types.ts';

/** Ending the old receipt identity prevents a later guest from claiming that its lost ledger still exists. */
export async function quiesceWorkspace({ job, apiKey, store }: MaintenanceInput): Promise<void> {
  fenceSandbox({ store });

  const remote = await readySandboxOrigin({ apiKey, name: job.sourceId });

  if (Option.isNone(remote)) {
    return;
  }

  const guest = store.remoteGuest();

  if (Option.isSome(guest)) {
    await endGuestProcess({ apiKey, origin: remote.value, machineId: guest.value });
  }

  const phase = SandboxPhase.Archive;

  store.saveMaintenance({ ...job, phase });
}

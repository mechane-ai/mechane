import { MachineId } from '@mechane/records';
import { MachineStatus } from '@mechane/sandbox-store';
import type { LiveMachineRow } from '@mechane/sandbox-store';
import { StartupFailure } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import type { ProviderStepInput } from '../types.ts';
import { hasUncheckpointedMachineLoss } from '../workspace/has-uncheckpointed-machine-loss.ts';
import { startMachine } from './start-machine.ts';

/**
 * The live machine, or a new one. Deciding that none is live and recording the new one as starting are one transaction.
 * A starting identity retries its idempotent provider start, including admission interrupted before acknowledgement.
 */
export async function openLiveMachine({ store, provider }: ProviderStepInput): Promise<Option.Option<LiveMachineRow>> {
  const machineId = MachineId.make(crypto.randomUUID());

  const openMachine: () => Option.Option<LiveMachineRow> = () => {
    const live = store.liveMachine();

    if (Option.isSome(live)) {
      return live;
    }

    if (hasUncheckpointedMachineLoss({ store })) {
      return Option.none();
    }

    const now = DateTime.nowUnsafe();

    store.openMachine({ machineId, now });

    return Option.some({ id: machineId, status: MachineStatus.Starting, startedAt: now });
  };

  const opened = store.atomic({ run: openMachine });

  if (Option.isNone(opened)) {
    return opened;
  }

  const machine = opened.value;

  if (machine.status === MachineStatus.Starting) {
    const restoration = store.workspace().restoration;
    const isRestoring = Option.exists(restoration, (value) => value.machineId === machine.id);

    if (isRestoring) {
      const guest = await provider.connect({ machineId: machine.id });

      if (Option.isNone(guest) && Option.isSome(restoration)) {
        const now = DateTime.nowUnsafe();

        const reason =
          'The machine was lost during file restoration; restore the committed generation on a fresh machine';

        store.atomic({
          run: () => {
            const current = store.workspace().restoration;

            const matches = Option.exists(
              current,
              (value) => value.machineId === machine.id && value.generation === restoration.value.generation,
            );

            if (!matches || Option.isNone(current)) {
              return;
            }

            store.failStartup({ machineId: machine.id, failure: StartupFailure.GuestLost, now });
            store.failMachine({ machineId: machine.id, startupDeadline: now, now });
            store.failRestoration({ restoration: current.value, reason });
          },
        });

        return Option.none();
      }
    }

    await startMachine({ store, provider, machine });
  }

  return opened;
}

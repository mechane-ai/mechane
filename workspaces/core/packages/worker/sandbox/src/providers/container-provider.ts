import { MACHINE_LEASE } from '@mechane/rpc';
import { GuestScope, GuestStart } from '@mechane/sandbox-wire';
import { Duration, Option, Schema } from 'effect';
import type { MachineProvider } from '../types.ts';
import { containerGuest } from './container-guest.ts';
import type { ContainerProviderInput } from './types.ts';

/** Reinstalls the per-instance inactivity lease before a running container's Durable Object accepts requests. */
export function containerProvider({ container, state }: ContainerProviderInput): MachineProvider {
  const timeout = Duration.toMillis(MACHINE_LEASE);

  if (container.running) {
    const restoreTimeout: () => Promise<void> = () => container.setInactivityTimeout(timeout);

    void state.blockConcurrencyWhile(restoreTimeout);
  }

  return {
    manage: Option.none(),
    suspend: Option.none(),
    start: async ({ machineId }) => {
      const environment = Schema.encodeSync(GuestStart)({ machineId, scope: GuestScope.Container });

      // A start throws while a container runs, so the running one is destroyed first.
      await container.destroy();
      container.start({ enableInternet: true, env: environment });
      await container.setInactivityTimeout(timeout);
    },
    connect: () => containerGuest({ container }),
    stop: () => container.destroy(),
  };
}

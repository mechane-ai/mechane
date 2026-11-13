import { SandboxContainerNetwork } from '@mechane/deployment';
import { MachineId } from '@mechane/records';
import { GATEWAY_CERTIFICATE, GuestScope, GuestStart } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Schema } from 'effect';
import { CONTAINER_INACTIVITY } from '../constants.ts';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import { containerGuest } from './container-guest.ts';
import { requireContainerMachine } from './container-machine.ts';
import { machineStartupTimeout } from './machine-startup-timeout.ts';
import { startContainer } from './start-container.ts';
import type { ContainerProviderInput } from './types.ts';

/** Reinstalls the per-instance inactivity lease before a running container's Durable Object accepts requests. */
export function containerProvider({
  container,
  state,
  onStartupExit,
  gateway,
  containerNetwork,
  additionalTools,
  isBrowserSandboxDisabled,
  trustedCertificatesPem,
}: ContainerProviderInput): MachineProvider {
  const watched = new Set<string>();

  function watchStartup({ machineId }: MachineIdInput): void {
    if (watched.has(machineId)) {
      return;
    }

    watched.add(machineId);

    async function observe(): Promise<void> {
      const promise = container.monitor();

      await capturePromise({ promise });
      watched.delete(machineId);

      if (container.running) {
        return;
      }

      onStartupExit({ machineId });
    }

    const observation = observe();

    state.waitUntil(observation);
  }

  const timeout = Duration.toMillis(CONTAINER_INACTIVITY);

  const browserCertificateFile = Option.some<typeof GATEWAY_CERTIFICATE>(GATEWAY_CERTIFICATE).pipe(
    Option.filter(() => containerNetwork === SandboxContainerNetwork.Gateway),
  );

  if (container.running) {
    const restoreTimeout: () => Promise<void> = () => container.setInactivityTimeout(timeout);

    void state.blockConcurrencyWhile(restoreTimeout);
  }

  return {
    startupTimeout: () => machineStartupTimeout({ tools: additionalTools }),
    start: async ({ machineId }) => {
      const identity = MachineId.make(machineId);
      const isRunning = await requireContainerMachine({ container, machineId: identity });

      if (isRunning) {
        watchStartup({ machineId: identity });

        await container.setInactivityTimeout(timeout);

        return;
      }

      const environment = Schema.encodeSync(GuestStart)({
        machineId: identity,
        scope: GuestScope.Container,
        additionalTools,
        isBrowserSandboxDisabled,
        browserCertificateFile,
        trustedCertificatesPem,
      });

      await startContainer({ container, gateway, environment, containerNetwork, machineId });
      watchStartup({ machineId: identity });
      await container.setInactivityTimeout(timeout);
    },
    connect: () => containerGuest({ container }),
    isAbsent: async () => {
      const inspected = await container.inspect();

      return Schema.is(Schema.Null)(inspected);
    },
    stop: async ({ machineId }) => {
      const identity = MachineId.make(machineId);

      await requireContainerMachine({ container, machineId: identity });
      await container.destroy();
    },
  };
}

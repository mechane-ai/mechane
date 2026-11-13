import { SandboxContainerNetwork } from '@mechane/deployment';
import { MachineId } from '@mechane/records';
import { GATEWAY_CERTIFICATE, GuestScope, GuestStart } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { CONTAINER_INACTIVITY } from '../constants.ts';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import { containerGuest } from './container-guest.ts';
import { requireContainerMachine } from './container-machine.ts';
import { containerWorkspaceCache } from './container-workspace-cache.ts';
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
  nativeImage,
  instance,
}: ContainerProviderInput): MachineProvider {
  const watched = new Set<string>();
  const expectedStops = new Set<MachineId>();

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

      if (!expectedStops.delete(machineId)) {
        const invalidation = cache.invalidateSelected({ machineId });

        await capturePromise({ promise: invalidation });
      }

      onStartupExit({ machineId });
    }

    const observation = observe();

    state.waitUntil(observation);
  }

  const timeout = Duration.toMillis(CONTAINER_INACTIVITY);

  const cache = containerWorkspaceCache({
    container,
    storage: state.storage,
    nativeImage,
    instance,
    configuration: { additionalTools, isBrowserSandboxDisabled, trustedCertificatesPem, containerNetwork },
  });

  const browserCertificateFile = Option.some<typeof GATEWAY_CERTIFICATE>(GATEWAY_CERTIFICATE).pipe(
    Option.filter(() => containerNetwork === SandboxContainerNetwork.Gateway),
  );

  if (container.running) {
    const restoreTimeout: () => Promise<void> = () => container.setInactivityTimeout(timeout);

    void state.blockConcurrencyWhile(restoreTimeout);
  }

  return {
    startupTimeout: () => machineStartupTimeout({ tools: additionalTools }),
    start: async ({ machineId, checkpoint }) => {
      const identity = MachineId.make(machineId);

      expectedStops.delete(identity);

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

      const startup = await cache.startup({ machineId, checkpoint });
      const start = startContainer({ container, gateway, environment, containerNetwork, machineId, startup });
      const started = await capturePromise({ promise: start });

      if (Result.isFailure(started)) {
        const selected = Option.fromNullishOr(startup.containerSnapshot);

        if (Option.isNone(selected)) {
          Result.getOrThrow(started);
        }

        await cache.invalidateSelected({ machineId });

        const observed = await container.inspect();
        const isAbsent = Schema.is(Schema.Null)(observed);

        if (!isAbsent) {
          Result.getOrThrow(started);
        }

        const portable = await cache.startup({ machineId, checkpoint });

        await startContainer({ container, gateway, environment, containerNetwork, machineId, startup: portable });
      }

      watchStartup({ machineId: identity });
      await container.setInactivityTimeout(timeout);
    },
    connect: () => containerGuest({ container }),
    isAbsent: async () => {
      const inspected = await container.inspect();

      return Schema.is(Schema.Null)(inspected);
    },
    restoredWorkspace: cache.restoredWorkspace,
    stop: async ({ machineId, checkpoint }) => {
      const identity = MachineId.make(machineId);

      const isRunning = await requireContainerMachine({ container, machineId: identity });

      if (isRunning && Option.isSome(checkpoint)) {
        await cache.capture({ machineId, checkpoint: checkpoint.value });
      }

      expectedStops.add(identity);
      await container.destroy();
    },
  };
}

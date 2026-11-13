import type { SandboxTools } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import { httpGuest } from './http-guest.ts';
import { MachineCall } from './machine-object.ts';
import type { MachineObject } from './machine-object.ts';
import { machineStartupTimeout } from './machine-startup-timeout.ts';

type RemoteContainerInput = {
  readonly machine: DurableObjectStub<MachineObject>;
  readonly tools: SandboxTools;
  readonly onStartupExit: (input: MachineIdInput) => void;
};

/** The Sandbox owns recovery and capacity; this adapter only reaches its compute owner. */
export function remoteContainerProvider({ machine, tools, onStartupExit }: RemoteContainerInput): MachineProvider {
  const encode = Schema.encodeSync(MachineCall);

  return {
    startupTimeout: () => machineStartupTimeout({ tools }),
    start: ({ machineId, checkpoint }) => {
      const encoded = encode({ machineId, checkpoint });

      return machine.start(encoded);
    },
    stop: ({ machineId, checkpoint }) => {
      const encoded = encode({ machineId, checkpoint });

      return machine.stop(encoded);
    },
    isAbsent: ({ machineId }) => machine.isAbsent({ machineId }),
    restoredWorkspace: ({ machineId, checkpoint }) => {
      const selected = Option.some(checkpoint);
      const encoded = encode({ machineId, checkpoint: selected });

      return machine.restoredWorkspace(encoded);
    },
    connect: async ({ machineId }) => {
      const observed = await machine.connection({ machineId });

      if (observed.hasExited) {
        onStartupExit({ machineId });
      }

      if (!observed.isConnected) {
        return Option.none();
      }

      const guest = httpGuest({
        fetch: ({ path, init }) => {
          const url = new URL(path, 'http://machine.invalid');
          const request = new Request(url, init);

          return machine.fetch(request);
        },
      });

      return Option.some(guest);
    },
  };
}

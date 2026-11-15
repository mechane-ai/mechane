import { SandboxContainerNetwork } from '@mechane/deployment';
import { ContainerStartupStep } from '../output/write-container-startup-timing.ts';
import type { MachineIdInput } from '../types.ts';
import { CONTAINER_MACHINE_LABEL } from './container-machine.ts';
import { observeContainerStartup } from './observe-container-startup.ts';
import type { ContainerProviderInput } from './types.ts';

type StartContainerInput = Pick<ContainerProviderInput, 'container' | 'gateway' | 'containerNetwork'> &
  MachineIdInput & {
    readonly environment: Readonly<Record<string, string>>;
    readonly startup: ContainerStartupOptions;
  };

/** Intercepts must precede startup and hostname rules must precede the HTTP catch-all. */
export async function startContainer({
  container,
  gateway,
  environment,
  containerNetwork,
  machineId,
  startup,
}: StartContainerInput): Promise<void> {
  const labels = { [CONTAINER_MACHINE_LABEL]: machineId };

  switch (containerNetwork) {
    case SandboxContainerNetwork.Direct:
      await observeContainerStartup({
        machineId,
        step: ContainerStartupStep.Start,
        run: () => container.start({ ...startup, enableInternet: true, env: environment, labels }),
      });

      return;
    case SandboxContainerNetwork.Gateway: {
      const outbound = gateway();

      await observeContainerStartup({
        machineId,
        step: ContainerStartupStep.HttpsIntercept,
        run: () => container.interceptOutboundHttps('*', outbound),
      });
      await observeContainerStartup({
        machineId,
        step: ContainerStartupStep.HttpIntercept,
        run: () => container.interceptAllOutboundHttp(outbound),
      });

      await observeContainerStartup({
        machineId,
        step: ContainerStartupStep.Start,
        run: () => container.start({ ...startup, enableInternet: false, env: environment, labels }),
      });
    }
  }
}

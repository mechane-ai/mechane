import { SandboxContainerNetwork } from '@mechane/deployment';
import type { MachineIdInput } from '../types.ts';
import { CONTAINER_MACHINE_LABEL } from './container-machine.ts';
import type { ContainerProviderInput } from './types.ts';

type StartContainerInput = Pick<ContainerProviderInput, 'container' | 'gateway' | 'containerNetwork'> &
  MachineIdInput & { readonly environment: Readonly<Record<string, string>> };

/** Intercepts must precede startup and hostname rules must precede the HTTP catch-all. */
export async function startContainer({
  container,
  gateway,
  environment,
  containerNetwork,
  machineId,
}: StartContainerInput): Promise<void> {
  const labels = { [CONTAINER_MACHINE_LABEL]: machineId };

  switch (containerNetwork) {
    case SandboxContainerNetwork.Direct:
      container.start({ enableInternet: true, env: environment, labels });

      return;
    case SandboxContainerNetwork.Gateway: {
      const outbound = gateway();

      await container.interceptOutboundHttps('*', outbound);
      await container.interceptAllOutboundHttp(outbound);

      container.start({ enableInternet: false, env: environment, labels });
    }
  }
}

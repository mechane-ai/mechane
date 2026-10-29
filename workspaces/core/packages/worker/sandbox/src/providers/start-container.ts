import { SandboxEgress } from '@mechane/deployment';
import type { ContainerProviderInput } from './types.ts';

type StartContainerInput = Omit<ContainerProviderInput, 'state'> & {
  readonly environment: Readonly<Record<string, string>>;
};

/** Intercepts must precede startup and hostname rules must precede the HTTP catch-all. */
export async function startContainer({ container, egress, gateway, environment }: StartContainerInput): Promise<void> {
  if (egress === SandboxEgress.Fence) {
    container.start({ enableInternet: true, env: environment });

    return;
  }

  const outbound = gateway();

  await container.interceptOutboundHttps('*', outbound);
  await container.interceptAllOutboundHttp(outbound);

  container.start({ enableInternet: false, env: environment });
}

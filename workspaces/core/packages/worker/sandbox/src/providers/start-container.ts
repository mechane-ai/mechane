import type { ContainerProviderInput } from './types.ts';

type StartContainerInput = Omit<ContainerProviderInput, 'state'> & {
  readonly environment: Readonly<Record<string, string>>;
};

/** Intercepts must precede startup and hostname rules must precede the HTTP catch-all. */
export async function startContainer({ container, gateway, environment }: StartContainerInput): Promise<void> {
  const outbound = gateway();

  await container.interceptOutboundHttps('*', outbound);
  await container.interceptAllOutboundHttp(outbound);

  container.start({ enableInternet: false, env: environment });
}

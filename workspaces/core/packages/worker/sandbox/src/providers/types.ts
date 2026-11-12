import type { SandboxContainerNetwork } from '@mechane/deployment';
import type { SandboxTools } from '@mechane/sandbox-wire';
import type { Option, Redacted } from 'effect';
import type { EgressGateway } from '../egress/egress-gateway.ts';
import type { MachineIdInput } from '../types.ts';

/** The container and Durable Object lifecycle that own its inactivity policy. */
export type ContainerProviderInput = {
  readonly onStartupExit: (input: MachineIdInput) => void;
  readonly container: Container;
  readonly state: DurableObjectState;
  readonly gateway: () => Fetcher;
  readonly containerNetwork: SandboxContainerNetwork;
  readonly additionalTools: SandboxTools;
  readonly isBrowserSandboxDisabled: boolean;
  readonly trustedCertificatesPem: Option.Option<string>;
};

type GatewayModule = { readonly EgressGateway: typeof EgressGateway };

declare global {
  namespace Cloudflare {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- Cloudflare merges this runtime interface.
    interface GlobalProps {
      readonly mainModule: GatewayModule;
    }
  }
}

/** The host launcher on this machine and the key it takes. */
export type HostProviderInput = {
  readonly launcherOrigin: URL;
  readonly launcherKey: Redacted.Redacted;
  readonly additionalTools: SandboxTools;
  readonly isBrowserSandboxDisabled: boolean;
  readonly trustedCertificatesPem: Option.Option<string>;
};

/** A machine's request to the host launcher, which starts the machine once and reports it after, or stops it. */
export type HostMachineInput = HostProviderInput & MachineIdInput;

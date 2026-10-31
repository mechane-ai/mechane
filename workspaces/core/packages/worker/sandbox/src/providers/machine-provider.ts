import { SandboxProvider } from '@mechane/deployment';
import { Option } from 'effect';
import type { MachineProvider } from '../types.ts';
import { containerProvider } from './container-provider.ts';
import { hostProvider } from './host-provider.ts';
import type { SandboxVariables } from './schemas.ts';

/** Where a sandbox's object runs its machines. */
type SandboxSettings = SandboxVariables;

/** The settings a sandbox's machines run by, and the object's own state, which holds its container. */
type MachineProviderInput = { readonly settings: SandboxSettings; readonly state: DurableObjectState };

/**
 * The provider the settings name. Only a class that `containers` names has a container, so a container setting without
 * one is a misconfigured deployment, whose object fails to construct and so fails readiness.
 */
export function machineProvider({ settings, state }: MachineProviderInput): MachineProvider {
  switch (settings.provider) {
    case SandboxProvider.Container:
      return containerProvider({
        state,
        container: Option.getOrThrow(Option.fromNullishOr(state.container)),
        egress: settings.egress,
        gateway: () => state.exports.EgressGateway({ props: {} }),
      });
    case SandboxProvider.Host:
      return hostProvider({ launcherOrigin: settings.launcherOrigin, launcherKey: settings.launcherKey });
  }
}

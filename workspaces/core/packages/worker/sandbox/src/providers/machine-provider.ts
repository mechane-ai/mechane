import { SandboxProvider } from '@mechane/deployment';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { tensorlakeProvider } from '../tensorlake/tensorlake-provider.ts';
import type { MachineProvider } from '../types.ts';
import { containerProvider } from './container-provider.ts';
import { hostProvider } from './host-provider.ts';
import type { SandboxVariables } from './schemas.ts';

const SANDBOX_NAME_CHARACTERS = 48;

/** Where a sandbox's object runs its machines. */
type SandboxSettings = SandboxVariables;

/** The settings a sandbox's machines run by, and the object's own state, which holds its container. */
type MachineProviderInput = {
  readonly settings: SandboxSettings;
  readonly state: DurableObjectState;
  readonly store: SandboxStore;
};

/**
 * The provider the settings name. Only a class that `containers` names has a container, so a container setting without
 * one is a misconfigured deployment, whose object fails to construct and so fails readiness.
 */
export function machineProvider({ settings, state, store }: MachineProviderInput): MachineProvider {
  const objectId = state.id.toString();
  const name = objectId.slice(0, SANDBOX_NAME_CHARACTERS);

  switch (settings.provider) {
    case SandboxProvider.Tensorlake:
      return tensorlakeProvider({ apiKey: settings.apiKey, image: settings.image, store, name: `foundry-${name}` });
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

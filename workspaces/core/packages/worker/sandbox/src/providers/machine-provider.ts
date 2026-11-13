import { SandboxProvider } from '@mechane/deployment';
import type { SandboxEnvironment } from '../environment.ts';
import { machineStub } from '../service/machine-settings.ts';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import { hostProvider } from './host-provider.ts';
import { remoteContainerProvider } from './remote-container-provider.ts';
import type { SandboxVariables } from './schemas.ts';

/** Where a sandbox's object runs its machines. */
type SandboxSettings = SandboxVariables;

/** The sandbox ledger selects a separate compute object or the local host launcher. */
type MachineProviderInput = {
  readonly settings: SandboxSettings;
  readonly state: DurableObjectState;
  readonly environment: SandboxEnvironment;
  readonly onStartupExit: (input: MachineIdInput) => void;
};

/** Provider selection leaves workspace authority in the sandbox ledger. */
export function machineProvider({
  settings,
  state,
  environment,
  onStartupExit,
}: MachineProviderInput): MachineProvider {
  switch (settings.provider) {
    case SandboxProvider.Container: {
      const name = state.id.toString();
      const machine = machineStub({ environment, name });

      return remoteContainerProvider({ machine, onStartupExit, tools: settings.additionalTools });
    }
    case SandboxProvider.Host:
      return hostProvider({
        launcherOrigin: settings.launcherOrigin,
        launcherKey: settings.launcherKey,
        additionalTools: settings.additionalTools,
        isBrowserSandboxDisabled: settings.isBrowserSandboxDisabled,
        trustedCertificatesPem: settings.trustedCertificatesPem,
      });
  }
}

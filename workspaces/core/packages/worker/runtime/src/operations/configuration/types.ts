import type { ControlStore } from '@mechane/control-store';
import type { RuntimeConfiguration } from '../../config.ts';

export type ConfigurationOperationsInput = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly isInstallationAdministrator: (principalId: string) => Promise<boolean>;
};

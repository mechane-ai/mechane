import type { RuntimeConfiguration } from '../../config.ts';
import type { RuntimeStore } from '../../store/database.ts';

export type ConfigurationOperationsInput = {
  readonly store: RuntimeStore;
  readonly configuration: RuntimeConfiguration;
  readonly isInstallationAdministrator: (principalId: string) => Promise<boolean>;
};

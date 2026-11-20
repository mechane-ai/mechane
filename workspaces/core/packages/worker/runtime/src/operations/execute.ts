import type { ControlStore } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import type { RuntimeConfiguration } from '../config.ts';
import { isInstallationAdministrator } from './auth/admission.ts';
import type { AuthenticationConfiguration } from './auth/configuration.ts';
import { createAuthOperations } from './auth/operations.ts';
import { createConfigurationOperations } from './configuration/configuration.ts';
import type { NamedOperationContext, OperationHandlers } from './types.ts';
import { validatedOperation } from './validated-operation.ts';

export type OperationExecutorOptions = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly authentication: AuthenticationConfiguration;
  readonly health: () => typeof catalog.health.output.Encoded;
  readonly readiness: () => Promise<typeof catalog.readiness.output.Encoded>;
};

export function createOperationExecutor(options: OperationExecutorOptions) {
  const { store, configuration, authentication } = options;

  const handlers: OperationHandlers = {
    ...createAuthOperations({ store, configuration: authentication }),
    ...createConfigurationOperations({
      store,
      configuration,
      isInstallationAdministrator: async (principalId) =>
        await isInstallationAdministrator({ store, configuration: authentication, principalId }),
    }),
    health: validatedOperation({ operation: catalog.health, run: async () => options.health() }),
    readiness: validatedOperation({ operation: catalog.readiness, run: async () => await options.readiness() }),
  };

  return async function executeOperation({
    name,
    input,
    caller,
    ...requestContext
  }: NamedOperationContext): Promise<unknown> {
    return await handlers[name]({ input, caller, ...requestContext });
  };
}

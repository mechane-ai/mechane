import type { ControlStore } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import type { MechActorResolver } from '../actor/client.ts';
import type { RuntimeConfiguration } from '../config.ts';
import { isInstallationAdministrator } from './auth/admission.ts';
import type { AuthenticationConfiguration } from './auth/configuration.ts';
import { createAuthOperations } from './auth/operations.ts';
import { createConfigurationOperations } from './configuration/configuration.ts';
import { createEnvironmentOperations } from './environment.ts';
import { createEvidenceOperations } from './evidence.ts';
import { createMechOperations } from './mechs/mechs.ts';
import { createNotificationOperations } from './notifications.ts';
import { requireSandboxEnabled } from './require-sandbox-enabled.ts';
import { createRoutineOperations } from './routines.ts';
import { createSelfOperations } from './self.ts';
import type { NamedOperationContext, OperationHandlers } from './types.ts';
import { requireAuthenticated, validatedOperation } from './validated-operation.ts';

type SandboxManagement = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly request: OperationInput<typeof catalog.manageSandbox>;
};

export type OperationExecutorOptions = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly authentication: AuthenticationConfiguration;
  readonly actors: MechActorResolver;
  readonly health: () => typeof catalog.health.output.Encoded;
  readonly readiness: () => Promise<typeof catalog.readiness.output.Encoded>;
  readonly manageSandbox: (input: SandboxManagement) => Promise<unknown>;
};

export function createOperationExecutor(options: OperationExecutorOptions) {
  const { store, configuration, authentication } = options;

  const handlers: OperationHandlers = {
    ...createNotificationOperations({ store, actors: options.actors }),
    ...createRoutineOperations({ store, actors: options.actors }),
    ...createSelfOperations({ store, actors: options.actors }),
    ...createAuthOperations({ store, configuration: authentication }),
    ...createEvidenceOperations({ store, configuration }),
    ...createEnvironmentOperations({ store, configuration }),
    ...createConfigurationOperations({
      store,
      configuration,
      isInstallationAdministrator: async (principalId) =>
        await isInstallationAdministrator({ store, configuration: authentication, principalId }),
    }),
    ...createMechOperations({ store, configuration, actors: options.actors }),
    health: validatedOperation({ operation: catalog.health, run: async () => options.health() }),
    readiness: validatedOperation({ operation: catalog.readiness, run: async () => await options.readiness() }),
    manageSandbox: validatedOperation({
      operation: catalog.manageSandbox,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          principalId: authenticated.principalId,
          isOwnerRequired: true,
        });

        await requireSandboxEnabled({ store, workspaceId: input.workspaceId });

        return await options.manageSandbox({ workspaceId: input.workspaceId, mechId: input.mechId, request: input });
      },
    }),
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

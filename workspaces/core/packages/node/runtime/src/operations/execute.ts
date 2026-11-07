import { catalog, SandboxDisabled } from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import type { RuntimeStore } from '../store/database.ts';
import { isInstallationAdministrator } from './auth/admission.ts';
import type { AuthenticationConfiguration } from './auth/configuration.ts';
import { createAuthOperations } from './auth/operations.ts';
import { createConfigurationOperations } from './configuration/configuration.ts';
import { createEnvironmentOperations } from './environment.ts';
import { createEvidenceOperations } from './evidence.ts';
import { createMechOperations } from './mechs/mechs.ts';
import type { CancelWorkflow, StartAdmission } from './mechs/mechs.ts';
import type { NamedOperationContext, OperationHandlers } from './types.ts';
import { requireAuthenticated, validatedOperation } from './validated-operation.ts';

type SandboxManagement = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly request: OperationInput<typeof catalog.manageSandbox>;
};

export type OperationExecutorOptions = {
  readonly store: RuntimeStore;
  readonly configuration: RuntimeConfiguration;
  readonly authentication: AuthenticationConfiguration;
  readonly startAdmission: StartAdmission;
  readonly cancelWorkflow: CancelWorkflow;
  readonly health: () => typeof catalog.health.output.Encoded;
  readonly readiness: () => Promise<typeof catalog.readiness.output.Encoded>;
  readonly manageSandbox: (input: SandboxManagement) => Promise<unknown>;
};

export function createOperationExecutor(options: OperationExecutorOptions) {
  const { store, configuration, authentication } = options;

  const handlers: OperationHandlers = {
    ...createAuthOperations({ store, configuration: authentication }),
    ...createEvidenceOperations({ store, configuration }),
    ...createEnvironmentOperations({ store, configuration }),
    ...createConfigurationOperations({
      store,
      configuration,
      isInstallationAdministrator: async (principalId) =>
        await isInstallationAdministrator({ store, configuration: authentication, principalId }),
    }),
    ...createMechOperations({
      store,
      configuration,
      startAdmission: options.startAdmission,
      cancelWorkflow: options.cancelWorkflow,
    }),
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

        const policy = await store.showWorkspacePolicy(input.workspaceId);

        if (!policy.hasSandboxes || policy.isSuspended) {
          throw new SandboxDisabled({ workspaceId: Schema.decodeUnknownSync(WorkspaceId)(input.workspaceId) });
        }

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

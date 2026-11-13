import type { ControlStore } from '@mechane/control-store';
import { catalog, ServiceUnavailable } from '@mechane/protocol';
import { ProcessObservation, SandboxAction, SandboxReport, SandboxRestoreResult } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { readSandboxProcess, stopSandboxProcess } from '../tools/processes/client.ts';
import { restoreSandboxWorkspace } from '../tools/restore-sandbox.ts';
import { manageSandboxWorkspace } from '../tools/sandbox-maintenance.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import { requireSandboxEnabled } from './require-sandbox-enabled.ts';
import type { AuthCaller } from './types.ts';
import { validatedOperation } from './validated-operation.ts';

type EnvironmentOperationsInput = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };
type EnvironmentAdmission = { readonly workspaceId: string; readonly mechId: string; readonly caller: AuthCaller };

/** The public Console observes existing handles only after current workspace membership and mech admission. */
export function createEnvironmentOperations({ store, configuration }: EnvironmentOperationsInput) {
  async function requireEnvironment({ workspaceId, mechId, caller }: EnvironmentAdmission): Promise<void> {
    await requireWorkspaceMember({ store, caller, workspaceId });
    await store.getMech({ workspaceId, mechId });
  }

  return {
    restoreSandbox: validatedOperation({
      operation: catalog.restoreSandbox,
      run: async ({ input, caller }) => {
        await requireEnvironment({ ...input, caller });

        await requireSandboxEnabled({ store, workspaceId: input.workspaceId });

        const result = await restoreSandboxWorkspace({ ...input, request: input, configuration }).catch(() => {
          throw new ServiceUnavailable({
            reason: 'The restore outcome is unknown; retry the same operation id and fences',
          });
        });

        return Schema.encodeSync(SandboxRestoreResult)(result);
      },
    }),
    showEnvironment: validatedOperation({
      operation: catalog.showEnvironment,
      run: async ({ input, caller }) => {
        await requireEnvironment({ ...input, caller });

        const report = await manageSandboxWorkspace({
          ...input,
          configuration,
          request: { action: SandboxAction.Show, operationId: Option.none() },
        }).catch(unavailable);

        return Schema.encodeSync(SandboxReport)(report);
      },
    }),
    showEnvironmentProcess: validatedOperation({
      operation: catalog.showEnvironmentProcess,
      run: async ({ input, caller }) => {
        await requireEnvironment({ ...input, caller });

        const process = await readSandboxProcess({ ...input, configuration, shouldTouch: false }).catch(unavailable);

        return Schema.encodeSync(ProcessObservation)(process);
      },
    }),
    stopEnvironmentProcess: validatedOperation({
      operation: catalog.stopEnvironmentProcess,
      run: async ({ input, caller }) => {
        await requireEnvironment({ ...input, caller });

        const process = await stopSandboxProcess({ ...input, configuration }).catch(unavailable);

        return Schema.encodeSync(ProcessObservation)(process);
      },
    }),
  };
}

function unavailable(): never {
  throw new ServiceUnavailable({ reason: 'The environment could not be observed; retry the same read' });
}

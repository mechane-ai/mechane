import { catalog, ServiceUnavailable } from '@mechane/protocol';
import { ProcessObservation, ProcessSummaries } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import type { RuntimeStore } from '../store/database.ts';
import { listSandboxProcesses, readSandboxProcess, stopSandboxProcess } from '../tools/processes/client.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import type { AuthCaller } from './types.ts';
import { validatedOperation } from './validated-operation.ts';

type EnvironmentOperationsInput = { readonly store: RuntimeStore; readonly configuration: RuntimeConfiguration };
type EnvironmentAdmission = { readonly workspaceId: string; readonly mechId: string; readonly caller: AuthCaller };

/** The public Console observes existing handles only after current workspace membership and mech admission. */
export function createEnvironmentOperations({ store, configuration }: EnvironmentOperationsInput) {
  async function requireEnvironment({ workspaceId, mechId, caller }: EnvironmentAdmission): Promise<void> {
    await requireWorkspaceMember({ store, caller, workspaceId });
    await store.getMech({ workspaceId, mechId });
  }

  return {
    listEnvironmentProcesses: validatedOperation({
      operation: catalog.listEnvironmentProcesses,
      run: async ({ input, caller }) => {
        await requireEnvironment({ ...input, caller });

        const processes = await listSandboxProcesses({ ...input, configuration, shouldTouch: false }).catch(
          unavailable,
        );

        return Schema.encodeSync(ProcessSummaries)(processes);
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
  throw new ServiceUnavailable({ reason: 'The environment could not be observed; retry the same process handle' });
}

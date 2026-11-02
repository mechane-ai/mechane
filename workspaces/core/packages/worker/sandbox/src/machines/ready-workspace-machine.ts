import { MachineStatus } from '@mechane/sandbox-store';
import type { LiveMachineRow } from '@mechane/sandbox-store';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { releaseMachineWorkspace } from '../workspace/release-machine-workspace.ts';
import { awaitHealth } from './await-health.ts';
import { openLiveMachine } from './open-live-machine.ts';

type ReadyWorkspaceMachineInput = WorkspaceProviderStepInput & { readonly deadline: DateTime.Utc };

/** A healthy machine whose committed files are restored and whose earlier archive has released its file fence. */
export async function readyWorkspaceMachine({
  store,
  provider,
  workspace,
  deadline,
}: ReadyWorkspaceMachineInput): Promise<Option.Option<LiveMachineRow>> {
  const machine = await openLiveMachine({ store, provider });
  const input = { store, provider, workspace, machineId: machine.id };
  const isHealthy = machine.status === MachineStatus.Ready || (await awaitHealth({ ...input, deadline }));

  if (!isHealthy || !(await releaseMachineWorkspace(input))) {
    return Option.none();
  }

  return Option.some(machine);
}

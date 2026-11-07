import { MachineId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult, MachineStatus } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { runFileCheckpoint } from '../checkpoints/run-file-checkpoint.ts';
import { observeMachine } from '../machines/observe-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';

/** A graceful stop commits a fresh frozen snapshot and preserves the machine if saving fails. */
export async function advanceIdleWorkspace({
  store,
  provider,
  workspace,
}: WorkspaceProviderStepInput): Promise<boolean> {
  const input = { store, provider, workspace };

  await observeMachine(input);

  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.status === MachineStatus.Starting) {
    return true;
  }

  const recovery = store.workspace().recovery;

  if (Option.isSome(recovery)) {
    return false;
  }

  const machineId = MachineId.make(live.value.id);
  const drain = store.requestMachineDrain({ machineId });
  const purpose = FileCheckpointPurpose.cases.Drain.make(drain);
  const result = await runFileCheckpoint({ ...input, purpose });

  if (FileCheckpointResult.guards.Failed(result)) {
    store.clearMachineDrain({ machineId });
  }

  return FileCheckpointResult.guards.Committed(result);
}

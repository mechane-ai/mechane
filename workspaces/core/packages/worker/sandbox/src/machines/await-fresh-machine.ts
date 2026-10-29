import { MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import type { FreshSourceMachine, MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { awaitHealth } from './await-health.ts';

type AwaitFreshMachineInput = WorkspaceProviderStepInput & MachineIdInput;

const FRESH_HEALTH_WAIT = Duration.seconds(1);

/** Restores a credential-free guest without admitting commands or restarting a generation that was already started. */
export async function awaitFreshMachine({
  store,
  provider,
  workspace,
  machineId,
}: AwaitFreshMachineInput): Promise<Option.Option<FreshSourceMachine>> {
  const live = store.liveMachine();
  const isReady = Option.exists(live, (machine) => machine.id === machineId && machine.status === MachineStatus.Ready);
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, FRESH_HEALTH_WAIT);
  const isRestored = isReady || (await awaitHealth({ store, provider, workspace, machineId, deadline }));

  if (!isRestored) {
    return Option.none();
  }

  const guest = await provider.connect({ machineId });

  return Option.map(guest, (connection) => ({ machineId, guest: connection }));
}

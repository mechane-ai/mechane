import { ExecutionStatus, MachineStatus } from '@mechane/sandbox-store';
import type { ExecutionRow, LiveMachineRow } from '@mechane/sandbox-store';
import type { ExecutionProgress } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { awaitHealth } from '../machines/await-health.ts';
import type { ProviderStepInput, StatusOf, WorkspaceProviderStepInput } from '../types.ts';
import { releaseMachineWorkspace } from '../workspace/release-machine-workspace.ts';
import { askGuest } from './ask-guest.ts';
import { executionProgress } from './execution-progress.ts';

/** A pending execution, as the store holds it. */
type PendingExecution = Extract<ExecutionRow, StatusOf<typeof ExecutionStatus.Pending>>;

/** A pending execution to send, and the time by which the call answers that it still runs. */
type DispatchPendingInput = WorkspaceProviderStepInput & {
  readonly execution: PendingExecution;
  readonly deadline: DateTime.Utc;
};

/** The live machine a call found, or the one it recorded as starting, which only that call starts. */
type OpenedMachine = { readonly machine: LiveMachineRow; readonly isOpened: boolean };

/**
 * Sends a pending execution to the live machine, starting one when none is live, once that machine's guest answers its
 * health; health proves the execution was never sent before. Until the call's deadline passes without health, the
 * execution stays pending, and the call answers that it still runs.
 */
export async function dispatchPending({
  store,
  provider,
  workspace,
  execution,
  deadline,
}: DispatchPendingInput): Promise<ExecutionProgress> {
  const machine = await liveMachine({ store, provider });

  const isReady =
    machine.status === MachineStatus.Ready ||
    (await awaitHealth({ store, provider, workspace, machineId: machine.id, deadline }));

  if (!isReady) {
    return executionProgress({ execution });
  }

  const isReleased = await releaseMachineWorkspace({ store, provider, workspace, machineId: machine.id });

  if (!isReleased) {
    return executionProgress({ execution });
  }

  store.dispatchExecution({ executionId: execution.id, machineId: machine.id, now: DateTime.nowUnsafe() });

  // The claim wrote the execution's row, which nothing deletes.
  const dispatched = Option.getOrThrow(store.execution({ executionId: execution.id }));

  if (dispatched.status === ExecutionStatus.Dispatched) {
    return await askGuest({ store, provider, workspace, execution: dispatched, deadline });
  }

  return executionProgress({ execution: dispatched });
}

/**
 * The live machine, or a new one. Deciding that none is live and recording the new one as starting are one transaction.
 * Only the call that recorded it starts it, and every other call waits for its health.
 */
async function liveMachine({ store, provider }: ProviderStepInput): Promise<LiveMachineRow> {
  const machineId = crypto.randomUUID();

  const openMachine: () => OpenedMachine = () => {
    const live = store.liveMachine();

    if (Option.isSome(live)) {
      return { machine: live.value, isOpened: false };
    }

    const now = DateTime.nowUnsafe();

    store.openMachine({ machineId, now });

    return { machine: { id: machineId, status: MachineStatus.Starting, startedAt: now }, isOpened: true };
  };

  const opened = store.atomic({ run: openMachine });

  if (opened.isOpened) {
    await provider.start({ machineId });
  }

  return opened.machine;
}

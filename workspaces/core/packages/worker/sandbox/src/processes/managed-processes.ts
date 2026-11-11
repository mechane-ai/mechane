import { Bytes, HttpMethod, MachineId } from '@mechane/records';
import type { ProcessRecord } from '@mechane/sandbox-store';
import {
  ExecutionEnvironmentRequired,
  ProcessCanceled,
  ProcessId,
  ProcessObservation,
  ProcessPending,
  ProcessState,
} from '@mechane/sandbox-wire';
import type { ExecutionEnvironment, ProcessHandle, SandboxProcessAnswer } from '@mechane/sandbox-wire';
import { DateTime, Option, Result, Schema } from 'effect';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import { readyInteractiveMachine } from '../machines/ready-interactive-machine.ts';
import type { GuestConnection, ProviderStepInput, WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';
import { processGuest } from './process-guest.ts';

type StartProcessInput = WorkspaceProviderStepInput & {
  readonly processId: ProcessId;
  /** None permits receipt reconciliation only; dispatch must first request current credentials. */
  readonly environment: Option.Option<ExecutionEnvironment>;
  readonly requireOwner: () => void;
};

type ObserveProcessInput = ProviderStepInput & { readonly handle: ProcessHandle; readonly shouldStop: boolean };
type StoredProcessInput = ProviderStepInput & { readonly record: ProcessRecord };
type ProcessConnection = { readonly handle: ProcessHandle; readonly guest: GuestConnection };
type ProcessHandleInput = Pick<StoredProcessInput, 'record'>;

class ProcessMachineMissing extends Schema.TaggedError<ProcessMachineMissing>()('ProcessMachineMissing', {
  processId: ProcessId,
}) {}

/** Resolves a durable start on its first machine and observes it before requesting current credentials. */
export async function startManagedProcess({
  store,
  provider,
  workspace,
  processId,
  environment,
  requireOwner,
}: StartProcessInput): Promise<SandboxProcessAnswer> {
  const record = store.requiredProcess({ processId });

  if (record.isStopRequested && Option.isNone(record.machineId)) {
    return ProcessCanceled.make({});
  }

  if (Option.isSome(record.observation) && !ProcessState.guards.Running(record.observation.value.state)) {
    return record.observation.value;
  }

  const input = { store, provider, workspace };

  if (!(await advanceWorkspace({ ...input, shouldAdmitCommand: true }))) {
    return ProcessPending.make({});
  }

  if (Option.isNone(record.machineId)) {
    const machine = await readyInteractiveMachine({ store, provider, workspace });

    if (Option.isNone(machine)) {
      return ProcessPending.make({});
    }

    const decoded = Schema.decodeUnknownResult(MachineId)(machine.value.id);
    const machineId = Result.getOrThrow(decoded);

    store.assignProcess({ processId, machineId });
  }

  const assigned = store.requiredProcess({ processId });
  const connection = await connectProcessMachine({ store, provider, record: assigned });

  if (Option.isNone(connection)) {
    return lostProcess({ store, record: assigned });
  }

  const { handle, guest } = connection.value;
  const noStart = Option.none();
  const current = await processGuest({ guest, handle, method: HttpMethod.Get, start: noStart });

  if (assigned.isStopRequested) {
    return await observeManagedProcess({ store, provider, handle, shouldStop: true });
  }

  if (Option.isSome(current)) {
    return commitProcessObservation({ store, observation: current.value });
  }

  const drain = store.machineDrain({ machineId: handle.machineId });

  if (Option.isSome(drain)) {
    return ProcessPending.make({});
  }

  const isReleased = await releaseWorkspace({ ...input, machineId: handle.machineId, guest });

  if (!isReleased) {
    return ProcessPending.make({});
  }

  requireOwner();

  const latest = store.requiredProcess({ processId });

  if (latest.isStopRequested) {
    return ProcessCanceled.make({});
  }

  if (Option.isNone(environment)) {
    return ExecutionEnvironmentRequired.make({});
  }

  const start = Option.some({ processId, command: assigned.command, environment });
  const dispatchedAt = DateTime.nowUnsafe();

  store.noteWorkspaceActivity({ now: dispatchedAt });

  const answer = await processGuest({ guest, handle, method: HttpMethod.Put, start });

  if (Option.isNone(answer)) {
    return lostProcess({ store, record: assigned });
  }

  return commitProcessObservation({ store, observation: answer.value });
}

/** Reads and stops address only the persisted machine; losing it cannot allocate a replacement. */
export async function observeManagedProcess({
  store,
  provider,
  handle,
  shouldStop,
}: ObserveProcessInput): Promise<ProcessObservation> {
  const record = store.process({ processId: handle.processId });

  if (
    Option.isNone(record) ||
    Option.isNone(record.value.machineId) ||
    record.value.machineId.value !== handle.machineId
  ) {
    const state = ProcessState.cases.Lost.make({});
    const omittedBytes = Bytes.make(0);

    return ProcessObservation.make({ handle, state, output: { text: '', omittedBytes } });
  }

  if (shouldStop) {
    store.requestProcessStop({ processId: handle.processId });
  }

  const saved = record.value.observation;

  if (Option.isSome(saved) && !ProcessState.guards.Running(saved.value.state)) {
    return saved.value;
  }

  const connection = await connectProcessMachine({ store, provider, record: record.value });

  if (Option.isNone(connection)) {
    return lostProcess({ store, record: record.value });
  }

  const method: typeof HttpMethod.Get | typeof HttpMethod.Delete = (() => {
    if (shouldStop || record.value.isStopRequested) {
      return HttpMethod.Delete;
    }

    return HttpMethod.Get;
  })();

  const noStart = Option.none();
  const answer = await processGuest({ ...connection.value, method, start: noStart });

  if (Option.isNone(answer)) {
    return lostProcess({ store, record: record.value });
  }

  return commitProcessObservation({ store, observation: answer.value });
}

async function connectProcessMachine({
  store,
  provider,
  record,
}: StoredProcessInput): Promise<Option.Option<ProcessConnection>> {
  const handle = processHandle({ record });
  const { machineId } = handle;
  const guest = await connectLiveMachine({ store, provider, machineId });

  if (Option.isNone(guest)) {
    return Option.none();
  }

  return Option.some({ handle, guest: guest.value });
}

function lostProcess({ store, record }: Pick<StoredProcessInput, 'store' | 'record'>): ProcessObservation {
  const handle = processHandle({ record });

  const output = Option.match(record.observation, {
    onNone: () => ({ text: '', omittedBytes: Bytes.make(0) }),
    onSome: (observation) => observation.output,
  });

  const state = ProcessState.cases.Lost.make({});
  const observation = ProcessObservation.make({ handle, state, output });

  return commitProcessObservation({ store, observation });
}

function processHandle({ record }: ProcessHandleInput): ProcessHandle {
  if (Option.isNone(record.machineId)) {
    const cause = new ProcessMachineMissing({ processId: record.processId });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  return { processId: record.processId, machineId: record.machineId.value };
}

type CommitProcessInput = Pick<ProviderStepInput, 'store'> & { readonly observation: ProcessObservation };

class ProcessReceiptMissing extends Schema.TaggedError<ProcessReceiptMissing>()('ProcessReceiptMissing', {
  processId: ProcessId,
}) {}

/** A concurrent foreground cancellation may have committed Lost while the guest response was in flight. */
function commitProcessObservation({ store, observation }: CommitProcessInput): ProcessObservation {
  const processId = observation.handle.processId;

  store.saveProcessObservation({ observation });

  const record = store.requiredProcess({ processId });

  if (Option.isNone(record.observation)) {
    const cause = new ProcessReceiptMissing({ processId });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  return record.observation.value;
}

import { RELEASE } from '@mechane/protocol';
import { RemoteSandboxId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { SandboxPhase } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';
import { storedProcessSummaries } from './stored-process-summaries.ts';

type EnvironmentReportStore = Pick<
  SandboxStore,
  | 'portableMaintenance'
  | 'liveMachine'
  | 'workspace'
  | 'latestReadyMachine'
  | 'machineDrain'
  | 'fileCheckpointResult'
  | 'latestSandboxStop'
  | 'latestStartup'
  | 'latestExecutionTiming'
  | 'latestStartupFailure'
  | 'processesObservedAt'
  | 'runningProcesses'
  | 'recentTerminalProcesses'
>;

type EnvironmentReportInput = { readonly store: EnvironmentReportStore; readonly providerName: string };
type StoreInput = Pick<EnvironmentReportInput, 'store'>;

/** Reports durable machine and maintenance state without waking a sleeping guest. */
export function environmentReport({ store, providerName }: EnvironmentReportInput): SandboxReport {
  const job = store.portableMaintenance();
  const live = store.liveMachine();
  const sandboxId = Option.map(live, ({ id }) => RemoteSandboxId.make(id));
  const phase = Option.match(job, { onNone: () => SandboxPhase.Idle, onSome: (value) => value.phase });
  const status = portableStatus({ store });

  return {
    provider: providerName,
    sandboxId,
    status,
    image: Option.none(),
    desiredImage: RELEASE,
    operationId: Option.map(job, (value) => value.id),
    action: Option.map(job, (value) => value.action),
    phase,
    lastError: Option.flatMap(job, (value) => value.lastError),
    environment: environmentState({ store }),
  };
}

function environmentState({ store }: StoreInput): SandboxReport['environment'] {
  const state = store.workspace();
  const observedProcesses = Result.try(() => storedProcessSummaries({ store }));
  const processes = Result.getSuccess(observedProcesses);
  const observedTime = Result.try(() => store.processesObservedAt());
  const processTime = Result.getSuccess(observedTime);
  const processesObservedAt = Option.flatten(processTime);

  const checkpoint = Option.map(state.checkpoint, (value) => {
    const transfer = {
      generation: value.generation,
      machineId: value.machineId,
      startedAt: value.startedAt,
      uploadedParts: value.part,
      totalParts: Option.map(value.archive, ({ parts }) => parts),
    };

    return {
      ...transfer,
      isAutomatic: FileCheckpointPurpose.guards.Automatic(value.purpose),
      executionId: Option.none(),
      operationId: Option.some(value.purpose.operationId),
    };
  });

  return {
    processes,
    processesObservedAt,
    lastStartupFailure: store.latestStartupFailure(),
    startup: store.latestStartup(),
    execution: store.latestExecutionTiming(),
    committedGeneration: Option.map(state.head, ({ generation }) => generation),
    checkpoint,
    durability: {
      activitySequence: state.activitySequence,
      capturedSequence: Option.flatMap(state.head, (head) => head.capturedSequence),
      capturedAt: Option.flatMap(state.head, (head) => head.capturedAt),
      nextCheckpointAt: state.automaticAt,
      lastError: state.checkpointError,
    },
    recovery: state.recovery,
    stop: store.latestSandboxStop(),
  };
}

function portableStatus({ store }: StoreInput): string {
  const live = store.liveMachine();
  const state = store.workspace();

  if (Option.isSome(state.recovery)) {
    return 'recovery_required';
  }

  if (Option.isSome(live)) {
    return live.value.status;
  }

  const checkpoint = checkpointInactiveEnvironment({ store });

  if (FileCheckpointResult.guards.Failed(checkpoint)) {
    return 'recovery_required';
  }

  if (Option.isSome(state.head)) {
    return 'sleeping';
  }

  return 'empty';
}

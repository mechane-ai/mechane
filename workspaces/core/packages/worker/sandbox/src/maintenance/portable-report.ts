import { RELEASE } from '@mechane/protocol';
import { RemoteSandboxId } from '@mechane/records';
import { FileCheckpointResult } from '@mechane/sandbox-store';
import { SandboxPhase } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';
import { inspectSandboxStop } from '../workspace/backfill-sandbox-stop.ts';
import type { PortableMaintenanceInput } from './types.ts';

/** Reports durable machine and maintenance state without waking a sleeping guest. */
export function portableReport({ store, providerName }: PortableMaintenanceInput): SandboxReport {
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

function environmentState({ store }: Pick<PortableMaintenanceInput, 'store'>): SandboxReport['environment'] {
  const state = store.workspace();

  const checkpoint = Option.map(state.checkpoint, (value) => {
    const transfer = {
      generation: value.generation,
      machineId: value.machineId,
      startedAt: value.startedAt,
      uploadedParts: value.part,
      totalParts: Option.map(value.archive, ({ parts }) => parts),
    };

    if ('executionId' in value) {
      return { ...transfer, executionId: Option.some(value.executionId), operationId: Option.none() };
    }

    return { ...transfer, executionId: Option.none(), operationId: Option.some(value.purpose.operationId) };
  });

  return {
    committedGeneration: Option.map(state.head, ({ generation }) => generation),
    checkpoint,
    recovery: state.recovery,
    stop: inspectSandboxStop({ store }),
  };
}

function portableStatus({ store }: Pick<PortableMaintenanceInput, 'store'>): string {
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

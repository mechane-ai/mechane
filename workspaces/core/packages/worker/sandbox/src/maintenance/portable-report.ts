import { RELEASE } from '@mechane/protocol';
import { RemoteSandboxId } from '@mechane/records';
import { SandboxPhase } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
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
  };
}

function portableStatus({ store }: Pick<PortableMaintenanceInput, 'store'>): string {
  const live = store.liveMachine();
  const snapshot = store.workspace().head;

  if (Option.isSome(live)) {
    return live.value.status;
  }

  if (Option.isSome(snapshot)) {
    return 'sleeping';
  }

  return 'empty';
}

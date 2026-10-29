import { SandboxAction } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { Option } from 'effect';
import { maintenanceValue } from './maintenance-value.ts';
import { prepareMaintenance } from './prepare-maintenance.ts';
import type { ManagePortableInput, PortableStepInput } from './types.ts';

/** Records an operation and its independent archive generation before any provider effect. */
export function beginPortableMaintenance({ store, providerName, request, ...context }: ManagePortableInput): void {
  const id = maintenanceValue({ value: request.operationId, field: 'operationId' });
  const state = store.workspace();

  const phase = prepareMaintenance({ store, providerName, request, ...context });
  const archive = Option.fromNullishOr(request.archive);
  const generation = RecordId.make(crypto.randomUUID());
  const target = Option.none();

  const job = {
    id,
    action: request.action,
    phase,
    provider: providerName,
    generation,
    source: state.head,
    archive,
    target,
    part: 0,
  };

  persistMaintenanceIntent({ store, job });
}

function persistMaintenanceIntent({ store, job }: Pick<PortableStepInput, 'store' | 'job'>): void {
  const previous = store.portableMaintenance();

  const commit: () => void = () => {
    if (Option.isSome(previous) && previous.value.action === SandboxAction.Export) {
      store.retireWorkspace({ generation: previous.value.generation });
    }

    store.savePortableMaintenance(job);
  };

  store.atomic({ run: commit });
}

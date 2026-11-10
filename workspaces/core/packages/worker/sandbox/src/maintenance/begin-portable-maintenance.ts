import { Option } from 'effect';
import { maintenanceValue } from './maintenance-value.ts';
import { prepareMaintenance } from './prepare-maintenance.ts';
import type { ManagePortableInput } from './types.ts';

export function beginPortableMaintenance({ store, providerName, request }: ManagePortableInput): void {
  const id = maintenanceValue({ value: request.operationId, field: 'operationId' });
  const phase = prepareMaintenance({ store, request });
  const workspace = store.workspace();
  const target = Option.none();
  const lastError = Option.none();

  store.savePortableMaintenance({
    id,
    action: request.action,
    phase,
    provider: providerName,
    source: workspace.head,
    target,
    lastError,
  });
}

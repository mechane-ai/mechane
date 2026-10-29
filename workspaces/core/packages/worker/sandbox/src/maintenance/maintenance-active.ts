import { SandboxPhase } from '@mechane/protocol';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';

type MaintenanceActiveInput = { readonly store: SandboxStore };

/** Both maintenance journals fence commands and idle destruction until they finish. */
export function maintenanceActive({ store }: MaintenanceActiveInput): boolean {
  const native = store.maintenance();
  const portable = store.portableMaintenance();
  const isNativeActive = Option.exists(native, (job) => job.phase !== SandboxPhase.Done);
  const isPortableActive = Option.exists(portable, (job) => job.phase !== SandboxPhase.Done);

  return isNativeActive || isPortableActive;
}

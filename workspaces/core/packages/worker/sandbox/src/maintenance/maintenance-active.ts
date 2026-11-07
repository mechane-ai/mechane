import type { SandboxStore } from '@mechane/sandbox-store';
import { SandboxPhase } from '@mechane/sandbox-wire';
import { Option } from 'effect';

type MaintenanceActiveInput = { readonly store: SandboxStore };
const TERMINAL_PHASES: ReadonlySet<SandboxPhase> = new Set([SandboxPhase.Done, SandboxPhase.Failed]);

export function maintenanceActive({ store }: MaintenanceActiveInput): boolean {
  const maintenance = store.portableMaintenance();

  return Option.exists(maintenance, (job) => !TERMINAL_PHASES.has(job.phase));
}

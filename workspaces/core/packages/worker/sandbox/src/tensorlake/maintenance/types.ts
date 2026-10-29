import type { SandboxMaintenance } from '@mechane/sandbox-store';
import type { TensorlakeSettings } from '../types.ts';

export type MaintenanceInput = TensorlakeSettings & { readonly job: SandboxMaintenance };

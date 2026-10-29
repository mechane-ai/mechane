import type { SandboxRequest } from '@mechane/protocol';
import type { PortableMaintenance } from '@mechane/sandbox-store';
import type { WorkspaceTransferInput } from '../types.ts';

export type PortableMaintenanceInput = WorkspaceTransferInput & { readonly providerName: string };
export type ManagePortableInput = PortableMaintenanceInput & { readonly request: SandboxRequest };
export type PortableStepInput = PortableMaintenanceInput & { readonly job: PortableMaintenance };

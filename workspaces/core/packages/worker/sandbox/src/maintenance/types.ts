import type { SandboxRequest } from '@mechane/protocol';
import type { PortableMaintenance } from '@mechane/sandbox-store';
import type { WorkspaceProviderStepInput } from '../types.ts';

export type PortableMaintenanceInput = WorkspaceProviderStepInput & { readonly providerName: string };
export type ManagePortableInput = PortableMaintenanceInput & { readonly request: SandboxRequest };
export type PortableStepInput = PortableMaintenanceInput & { readonly job: PortableMaintenance };

import type { PortableMaintenance } from '@mechane/sandbox-store';
import type { SandboxAction, SandboxRequest } from '@mechane/sandbox-wire';
import type { WorkspaceProviderStepInput } from '../types.ts';

export type PortableMaintenanceInput = WorkspaceProviderStepInput & { readonly providerName: string };
type PortableRequest = Pick<SandboxRequest, 'operationId'> & { readonly action: SandboxAction };
export type ManagePortableInput = PortableMaintenanceInput & { readonly request: PortableRequest };
export type PortableStepInput = PortableMaintenanceInput & { readonly job: PortableMaintenance };

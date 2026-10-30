import type { WorkspaceAuthorityInput } from '../types.ts';

export type CredentialScenarioInput = WorkspaceAuthorityInput & { readonly guarantee: string };

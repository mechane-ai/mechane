import type { WorkspaceId } from '@mechane/records';
import type { ObjectBindings, ObjectSettings } from '@mechane/rpc';

/** Integration adapters read workspace records and the current operator keyring through these bindings. */
export type IntegrationSettings = ObjectBindings & Pick<ObjectSettings, 'credentialKeyring'>;

/** Encryption binds a credential to this trusted workspace and reference, independently of its stored envelope. */
export type CredentialIdentity = { readonly workspaceId: typeof WorkspaceId.Encoded; readonly secretReference: string };

/** Credential resolution uses the owning workspace's row and the installation's current decryption keys. */
export type ResolveIntegrationSecretInput = CredentialIdentity & { readonly settings: IntegrationSettings };

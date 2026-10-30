import { deleteCredential } from './delete-credential.ts';
import { listCredentials } from './list-credentials.ts';
import { putCredential } from './put-credential.ts';

/** Owners manage credential values separately from the integrations that reference them. */
export const CREDENTIAL_OPERATIONS = { putCredential, listCredentials, deleteCredential } as const;

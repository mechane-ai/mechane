import type { SqlCall } from '@mechane/store';
import type { CredentialReferenceInput } from './types.ts';

/** Removing an absent reference succeeds so repeated credential revocation is safe. */
export function deleteCredential({ sql, secretReference }: SqlCall<CredentialReferenceInput>): void {
  sql.exec('DELETE FROM integration_credentials WHERE secret_reference = ?', secretReference);
}

import { EncryptedCredential } from '@mechane/deployment';
import { renamedWireStruct } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import type { Option } from 'effect';
import type { CredentialReferenceInput } from './types.ts';

const EncryptedCredentialRow = renamedWireStruct({ fields: EncryptedCredential.fields, renames: {} });

type EncryptedCredentialRow = typeof EncryptedCredentialRow.Type;

/** The caller receives an encrypted envelope; only the credential owner can decrypt it with workspace-bound context. */
export function readCredential({
  sql,
  secretReference,
}: SqlCall<CredentialReferenceInput>): Option.Option<EncryptedCredential> {
  const cursor = sql.exec(
    'SELECT key_version, nonce, ciphertext FROM integration_credentials WHERE secret_reference = ?',
    secretReference,
  );

  return decodeFirst({ cursor, schema: EncryptedCredentialRow });
}

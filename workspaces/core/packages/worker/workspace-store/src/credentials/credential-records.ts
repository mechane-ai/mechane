import type { EncryptedCredential } from '@mechane/deployment';
import type { CredentialMetadata } from '@mechane/protocol';
import type { RecordsInput } from '@mechane/store';
import type { Option } from 'effect';
import { deleteCredential } from './delete-credential.ts';
import { listCredentials } from './list-credentials.ts';
import { readCredential } from './read-credential.ts';
import { saveCredential } from './save-credential.ts';
import type { CredentialReferenceInput, SaveCredentialInput } from './types.ts';

/** Credential storage accepts encrypted envelopes and exposes only metadata to listing callers. */
export type CredentialRecords = ReturnType<typeof credentialRecords>;

/** Binds credential operations to the owning workspace's database. */
export function credentialRecords({ sql }: RecordsInput) {
  return {
    credential: (input: CredentialReferenceInput): Option.Option<EncryptedCredential> =>
      readCredential({ sql, ...input }),
    credentials: (): ReadonlyArray<CredentialMetadata> => listCredentials({ sql }),
    saveCredential: (input: SaveCredentialInput): CredentialMetadata => saveCredential({ sql, ...input }),
    deleteCredential: (input: CredentialReferenceInput): void => deleteCredential({ sql, ...input }),
  };
}

import type { EncryptedCredential } from '@mechane/deployment';
import type { IntegrationSecretReference } from '@mechane/protocol';
import type { DateTime } from 'effect';

export type CredentialReferenceInput = { readonly secretReference: IntegrationSecretReference };

export type SaveCredentialInput = CredentialReferenceInput & {
  readonly credential: EncryptedCredential;
  readonly now: DateTime.Utc;
};

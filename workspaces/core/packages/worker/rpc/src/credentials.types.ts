import type { EncryptedCredential } from '@mechane/deployment';

export type CredentialReferenceInput = { readonly secretReference: string };

export type SaveCredentialInput = CredentialReferenceInput & {
  readonly credential: typeof EncryptedCredential.Encoded;
  readonly isCreateOnly: boolean;
};

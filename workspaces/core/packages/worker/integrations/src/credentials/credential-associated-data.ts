import type { CredentialIdentity } from '../types.ts';

const CREDENTIAL_PURPOSE = 'mechane.workspace-credential.v1';

/** The trusted lookup identity binds the ciphertext; stored envelope fields never select its owner. */
export function credentialAssociatedData({
  workspaceId,
  secretReference,
}: CredentialIdentity): Uint8Array<ArrayBuffer> {
  const identity = JSON.stringify([CREDENTIAL_PURPOSE, workspaceId, secretReference]);
  const encoder = new TextEncoder();

  const bytes = encoder.encode(identity);

  return new Uint8Array(bytes);
}

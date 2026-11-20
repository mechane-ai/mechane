import { Redacted } from 'effect';
import { createHmac } from 'node:crypto';
import type { InstalledSession } from './installed-session.ts';
import { digestWorkToken, encodeWorkSecret, WORK_TOKEN_PREFIX } from './work-records.ts';

export type InstalledSigning = { readonly origin: string; readonly signingKey: Redacted.Redacted };
type CredentialInput = InstalledSession & InstalledSigning & { readonly leaseId: string };

export function installedWorkCredential({
  workspaceId,
  environmentId,
  sessionId,
  leaseId,
  origin,
  signingKey,
}: CredentialInput) {
  const binding = JSON.stringify(['managed-installed-work-v1', workspaceId, environmentId, sessionId, leaseId]);
  const signature = createHmac('sha256', Redacted.value(signingKey)).update(binding).digest('base64url');
  const token = WORK_TOKEN_PREFIX + signature;

  return { digest: digestWorkToken(token), secret: encodeWorkSecret(origin, token) };
}

import type { BrowserIdentity } from '@mechane/records';

type IdentityKeyInput = { readonly identity: BrowserIdentity };

/** Keeps rate limits for one identity separate from equal subject values issued by another provider. */
export function identityKey({ identity }: IdentityKeyInput): string {
  return `${identity.provider}:${identity.subject}`;
}

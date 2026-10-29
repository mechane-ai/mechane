import { TOKEN_RANDOM_BYTES } from '@mechane/protocol';
import { Base64Url } from 'effect/encoding';

type IssueTokenInput = { readonly prefix: string };

/** A new secret token: its kind's prefix, then random bytes from the runtime's secure source. */
export function issueToken({ prefix }: IssueTokenInput): string {
  return `${prefix}${Base64Url.encode(crypto.getRandomValues(new Uint8Array(TOKEN_RANDOM_BYTES)))}`;
}

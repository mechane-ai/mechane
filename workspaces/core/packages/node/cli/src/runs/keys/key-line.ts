import type { KeyMetadata } from '@mechane/protocol';
import { DateTime, Option } from 'effect';

type KeyLineInput = { readonly key: KeyMetadata };

/** One key as a person reads it: its id, name and purpose, and when it expires or was revoked. */
export function keyLine({ key }: KeyLineInput): string {
  const { revokedAt } = key;

  const ending: string = (() => {
    if (Option.isNone(revokedAt)) {
      return `expires at ${DateTime.formatIso(key.expiresAt)}`;
    }

    return `revoked at ${DateTime.formatIso(revokedAt.value)}`;
  })();

  return `${key.id} ${key.name} (${key.purpose}) ${ending}`;
}

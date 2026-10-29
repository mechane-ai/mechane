import type { DirectoryStore } from '@mechane/directory-store';
import type { KeyAccessAnswer } from '@mechane/protocol';
import { Option } from 'effect';

/** A key's token hash, and the store to read its access from. */
type ReadKeyAccessInput = { readonly store: DirectoryStore; readonly tokenHash: string };

/**
 * The key with the token's hash and its principal, read in one transaction for the key's cache shard, which judges
 * revocation and expiry itself.
 */
export function readKeyAccess({ store, tokenHash }: ReadKeyAccessInput): typeof KeyAccessAnswer.Encoded {
  const read: () => typeof KeyAccessAnswer.Encoded = () => {
    const found = store.keyForToken({ tokenHash });

    if (Option.isNone(found)) {
      return { _tag: 'Unknown' };
    }

    const key = found.value;

    return { _tag: 'Found', access: { key, principal: store.principal({ principalId: key.principalId }) } };
  };

  return store.atomic({ run: read });
}

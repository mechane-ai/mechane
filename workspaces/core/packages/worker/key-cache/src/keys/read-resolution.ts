import type { KeyCacheStore } from '@mechane/key-cache-store';
import { CachedResolution } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { judgeKey } from './judge-key.ts';

/** A token's hash to resolve from the shard's store, at the call's instant. */
type ReadResolutionInput = { readonly store: KeyCacheStore; readonly tokenHash: string; readonly now: DateTime.Utc };

/** The shard's judgment of the key with the token's hash, or none cached yet, which the directory fills. */
export function readResolution({ store, tokenHash, now }: ReadResolutionInput): typeof CachedResolution.Encoded {
  const row = store.cachedKey({ tokenHash });

  if (Option.isNone(row)) {
    return CachedResolution.cases.Missing.make({});
  }

  return judgeKey({ row: row.value, now });
}

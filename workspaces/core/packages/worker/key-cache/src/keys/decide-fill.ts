import type { KeyCacheStore } from '@mechane/key-cache-store';
import type { FillKeyInput } from '@mechane/protocol';
import type { JudgedKey } from '@mechane/rpc';
import type { DateTime } from 'effect';
import { judgeKey } from './judge-key.ts';

/** The directory's resolution of a key the shard missed, filled into the shard's store at the call's instant. */
type DecideFillInput = {
  readonly store: KeyCacheStore;
  readonly tokenHash: string;
  readonly access: FillKeyInput['access'];
  readonly now: DateTime.Utc;
};

/**
 * Stores the directory's resolution of a key the shard missed, unless a row came first, and judges what the shard
 * holds, in one transaction.
 */
export function decideFill({ store, tokenHash, access, now }: DecideFillInput): typeof JudgedKey.Encoded {
  const fill: () => typeof JudgedKey.Encoded = () => {
    const row = store.fillKey({ tokenHash, access });

    return judgeKey({ row, now });
  };

  return store.atomic({ run: fill });
}

import { openKeyCacheStore } from '@mechane/key-cache-store';
import type { KeyCacheStore } from '@mechane/key-cache-store';
import type { FillKeyInput } from '@mechane/protocol';
import type { TokenHashInput } from '@mechane/records';
import type { CachedResolution, JudgedKey, KeyCacheRpc } from '@mechane/rpc';
import { DurableObject } from 'cloudflare:workers';
import { DateTime } from 'effect';
import { decideFill } from './keys/decide-fill.ts';
import { readResolution } from './keys/read-resolution.ts';

/**
 * One of the 256 shards of the key cache, named by the first two hex digits of a token's hash, so admission reads a key
 * without the deployment's one directory. It holds a key the directory resolved, never an unknown token, so a random
 * token stores nothing. It judges expiry by its own clock, and a revocation's tombstone outlasts every fill.
 */
export class KeyCacheObject extends DurableObject<unknown> implements KeyCacheRpc {
  readonly #store: KeyCacheStore;

  constructor(state: DurableObjectState, environment: unknown) {
    super(state, environment);

    this.#store = openKeyCacheStore({ storage: state.storage });
  }

  /** The count of schema migrations the shard's database has applied. */
  schemaRevision(): number {
    return this.#store.schemaRevision();
  }

  resolveKey({ tokenHash }: TokenHashInput): typeof CachedResolution.Encoded {
    return readResolution({ store: this.#store, tokenHash, now: DateTime.nowUnsafe() });
  }

  /** Stores the directory's resolution of a key the shard missed, unless a row came first, and judges what it holds. */
  fillKey({ tokenHash, access }: FillKeyInput): typeof JudgedKey.Encoded {
    return decideFill({ store: this.#store, tokenHash, access, now: DateTime.nowUnsafe() });
  }

  /** Writes the key's tombstone, before the directory revokes it, so the revoked key fails at once. */
  revokeKey({ tokenHash }: TokenHashInput): void {
    this.#store.revokeKey({ tokenHash, now: DateTime.nowUnsafe() });
  }
}

import type { KeyCacheRpc } from '../key-cache.types.ts';
import type { ObjectBindings } from '../types.ts';

type KeyCacheStubInput = { readonly bindings: ObjectBindings; readonly tokenHash: string };

/** The hex digits of a token's hash that name its key cache shard: two, so the cache has 256 shards. */
const KEY_CACHE_SHARD_DIGITS = 2;

/** The stub of the key cache shard of a token's hash, which the hash's first two hex digits name. */
export function keyCacheStub({ bindings, tokenHash }: KeyCacheStubInput): DurableObjectStub<KeyCacheRpc> {
  return bindings.keyCaches.get(bindings.keyCaches.idFromName(tokenHash.slice(0, KEY_CACHE_SHARD_DIGITS)));
}

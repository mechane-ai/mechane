# @mechane/key-cache

The key-cache Durable Object and its decisions.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `keys/`: a token's resolution from the shard, the fill of a key the directory resolved, and the judgment of a cached
  key's revocation and expiry.

## Use

- `KeyCacheObject` is one of 256 shards, named by the first two hex digits of a token's hash. Admission reads a key from
  its shard; workspace admission then reads current membership from the directory.
- `resolveKey` answers the shard's judgment of a key, or `Missing`; the Worker then fills it with `fillKey` from the
  directory's answer.
- The edge calls `revokeKey` before the directory revokes the key. Its tombstone outlasts every later fill.

## Never

- Never store an unknown token: only a key the directory resolved is filled.
- Never judge expiry by any clock but the shard's own.
- Never grant workspace access from cached membership.

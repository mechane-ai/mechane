# @mechane/key-cache-store

The key-cache object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/key-cache`

## Layout

- `keys/`: each cached key by token hash, live or revoked, with its principal.

## Use

- `openKeyCacheStore` opens the store migrated; `atomic` runs one decision and its writes as one transaction.
- `cachedKey` answers a key's row tagged `Live` or `Revoked`, and none for a token the shard never held. `fillKey`
  answers the row the shard holds after it: the fill's own, or the row that came first, a tombstone included.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never let a fill replace a revoked key's tombstone.

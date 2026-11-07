# @mechane/store

The sandbox's SQLite kernel: migrations, synchronous transactions, and row decoding.

Layer 2 · worker · plain · consumer: `@mechane/sandbox-store`

## Use

- `openDatabase` opens an object's database with every migration its ledger lacks applied in one transaction. Its
  `atomic` runs one decision and the writes it makes as one transaction.
- `decodeRows`, `decodeOne`, and `decodeFirst` decode statement results in the owning sandbox store.
- The database handle reports the applied migration count through `schemaRevision`.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never make an outbound call inside `atomic`; its statements run synchronously, so nothing interleaves with them.
- Never decode a row a store wrote as anything but a defect when it fails: only the store writes its database.

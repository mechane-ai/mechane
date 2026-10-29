# @mechane/store

The SQL kernel every object's database shares: the migration ledger, its transactions, row decoding and the pages of a
list that grows.

Layer 2 · worker · plain · consumers: every object store and object, `@mechane/harness` and `@mechane/harness-tools`

## Use

- `openDatabase` opens an object's database with every migration its ledger lacks applied in one transaction. Its
  `atomic` runs one decision and the writes it makes as one transaction.
- `decodeRows`, `decodeOne`, `decodeFirst` and `decodeNonEmptyRows` are the only ways a store decodes a statement's
  rows.
- `readPage` reads one page of a list that grows, after the record a reader has last, and says whether more follow.
- `rowCount` reads a `COUNT(*) AS count` statement, and `schemaRevision` the count of applied migrations.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never make an outbound call inside `atomic`; its statements run synchronously, so nothing interleaves with them.
- Never decode a row a store wrote as anything but a defect when it fails: only the store writes its database.

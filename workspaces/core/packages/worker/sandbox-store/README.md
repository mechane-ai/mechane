# @mechane/sandbox-store

The sandbox object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/sandbox`

## Layout

- `executions/`: the executions a sandbox claimed, each with its request, its machine and its receipt once settled.
- `machines/`: the machines a sandbox opened, the live one and how each ended.
- `workspaces/`: provider binding, committed generation, checkpoint/restore cursors, failed-save recovery and
  retirement.
- `sources/`: credential fences that survive Worker restarts until revocation or confirmed expiry.

## Use

- `openSandboxStore` opens the store on the object's storage, migrated, and `atomic` runs one decision as a transaction.
- `sandboxAlarm` arms the object's alarm at an instant, and clears it only when it is still armed there.
- Cancellation tombstones are durable before queued dispatch; terminal receipts are immutable.
- A portable workspace head commits in the same transaction as its execution receipt.
- Rows carry their instants as `DateTime.Utc` and their spans as `Duration`; the tables keep milliseconds.

## Never

- Never change a deployed migration: add a new one to `MIGRATIONS`.
- Never decode a row outside its record function.

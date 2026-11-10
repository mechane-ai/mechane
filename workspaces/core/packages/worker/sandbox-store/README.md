# @mechane/sandbox-store

The sandbox object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/sandbox`

## Layout

- `executions/`: the executions a sandbox claimed, each with its request, its machine and its receipt once settled.
- `processes/`: managed process intents, their trusted run and tool-call identities, and terminal observations.
- `browser/`: browser action receipts and tab bindings that retain their original machine.
- `evidence/`: private capture metadata, bounded upload chunks, and durable object storage.
- `machines/`: machine identity, drains, and durable stop receipts retained after failure or replacement.
- `workspaces/`: provider binding, committed generation, checkpoint/restore cursors, failed-save recovery and
  retirement.
- `capacity/`: bound owner identity and durable machine start/stop intent.
- `maintenance/`: the current explicit replacement or deletion operation.

## Use

- `openSandboxStore` opens the store on the object's storage, migrated, and `atomic` runs one decision as a transaction.
- `sandboxAlarm` arms the object's alarm at an instant, and clears it only when it is still armed there.
- Cancellation tombstones are durable before queued dispatch; terminal receipts are immutable.
- Interactive cancellation belongs to the native run and fences later process and browser claims from that run.
- A portable workspace head commits in the same transaction as its execution receipt.
- New heads reference an immutable R2 generation manifest by digest. Existing inline heads stay readable.
- A graceful drain retains its checkpoint identity until that exact machine stops.
- Rows carry their instants as `DateTime.Utc` and their spans as `Duration`; the tables keep milliseconds.

## Never

- Never change a deployed migration: add a new one to `MIGRATIONS`.
- Never decode a row outside its record function.
